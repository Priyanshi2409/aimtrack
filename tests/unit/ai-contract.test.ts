import { describe, expect, it } from "vitest";
import { sanitizePlan } from "@/lib/ai/agents";
import { mockPlan } from "@/lib/ai/mock";
import { AIError, type AIProvider, type CompleteOptions } from "@/lib/ai/provider";
import { PlanSchema, ResearchStepSchema } from "@/lib/ai/schemas";
import { extractJson, generateStructured, parseStructured } from "@/lib/ai/structured";
import { normalizeUrl, verifySources } from "@/lib/ai/urls";

function fakeProvider(replies: string[]): AIProvider & { calls: CompleteOptions[] } {
  const calls: CompleteOptions[] = [];
  return {
    id: "fake",
    calls,
    async complete(o) {
      calls.push(o);
      return replies.shift() ?? "";
    },
    async *stream() {},
    async completeWithWebSearch() {
      return { text: "", sources: [], searchCount: 0 };
    },
  };
}

const goal = {
  title: "Run a half marathon",
  raw_input: "Run a half marathon by March",
  category: "fitness",
  answers: [],
  start_date: "2026-09-28",
  deadline: "2027-03-01",
  minutes_per_day: 45,
  today: "2026-09-28",
};

const validPlan = () => {
  const p = mockPlan(goal);
  return JSON.stringify(p);
};

describe("extractJson", () => {
  it("handles fences and surrounding prose", () => {
    expect(extractJson('Here you go:\n```json\n{"a":1}\n```\nthanks')).toEqual({ a: 1 });
    expect(extractJson('Sure! {"a":{"b":2}} done')).toEqual({ a: { b: 2 } });
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("plan contract (Zod)", () => {
  it("accepts a well-formed plan", () => {
    expect(parseStructured(PlanSchema, validPlan()).ok).toBe(true);
  });

  it("rejects bad verdicts, missing fields and out-of-range values with precise messages", () => {
    const bad = JSON.parse(validPlan());
    bad.feasibility.verdict = "Totally fine";
    bad.daily_tasks[0].estimated_minutes = 2;
    delete bad.phases[0].milestones;
    const r = parseStructured(PlanSchema, JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("feasibility.verdict");
      expect(r.error).toContain("daily_tasks.0.estimated_minutes");
      expect(r.error).toContain("phases.0.milestones");
    }
  });
});

describe("generateStructured retry", () => {
  it("returns first valid answer without retrying", async () => {
    const p = fakeProvider([validPlan()]);
    await generateStructured(p, PlanSchema, { tier: "smart", system: "s", messages: [{ role: "user", content: "go" }] });
    expect(p.calls).toHaveLength(1);
  });

  it("retries once with the validation error, then succeeds", async () => {
    const p = fakeProvider(['{"feasibility": "oops"}', validPlan()]);
    const plan = await generateStructured(p, PlanSchema, { tier: "smart", system: "s", messages: [{ role: "user", content: "go" }] });
    expect(plan.phases.length).toBeGreaterThan(0);
    expect(p.calls).toHaveLength(2);
    const retryMsg = p.calls[1].messages.at(-1)!.content;
    expect(retryMsg).toMatch(/Schema validation failed/);
    expect(retryMsg).toMatch(/feasibility/);
  });

  it("throws a friendly invalid_output error after the single retry", async () => {
    const p = fakeProvider(["not json", "still not json", "never asked"]);
    await expect(generateStructured(p, PlanSchema, { tier: "smart", system: "s", messages: [{ role: "user", content: "go" }] })).rejects.toMatchObject({
      code: "invalid_output",
    });
    expect(p.calls).toHaveLength(2);
    const err = new AIError("invalid_output");
    expect(err.userMessage).toMatch(/couldn't understand/);
    expect(err.retryable).toBe(true);
  });
});

describe("citation verification", () => {
  it("normalises URLs for comparison", () => {
    expect(normalizeUrl("http://www.Example.com/a/?utm_source=x#top")).toBe(normalizeUrl("https://example.com/a"));
  });

  it("drops research items whose URL the search tool never returned", () => {
    const items = [
      { title: "Real", summary: "x".repeat(20), source_url: "https://real.org/story" },
      { title: "Invented", summary: "x".repeat(20), source_url: "https://made-up.example/fake" },
    ];
    const { kept, dropped } = verifySources(items, ["https://www.real.org/story/"]);
    expect(kept.map((k) => k.title)).toEqual(["Real"]);
    expect(dropped.map((k) => k.title)).toEqual(["Invented"]);
  });

  it("research schema requires a source URL on every item", () => {
    const r = ResearchStepSchema.safeParse({ items: [{ title: "No source", summary: "a summary here" }], note: null });
    expect(r.success).toBe(false);
  });

  it("sanitizePlan removes unverified examples/resources and enforces capacity", () => {
    const plan = PlanSchema.parse(JSON.parse(validPlan()));
    plan.real_world_examples = [
      { summary: "A real runner's story from research", source_url: "https://real.org/runner" },
      { summary: "A hallucinated story that has no source", source_url: "https://fake.org/x" },
    ];
    plan.daily_tasks[0].resource_url = "https://fake.org/course";
    plan.daily_tasks[1].resource_url = "https://real.org/runner";
    plan.daily_tasks[2].estimated_minutes = 200;
    plan.daily_tasks[3].phase_index = 99;
    const clean = sanitizePlan(plan, [{ kind: "examples", title: "t", summary: "s", source_url: "https://real.org/runner" }], 45);
    expect(clean.real_world_examples).toHaveLength(1);
    const byTitle = new Map(clean.daily_tasks.map((t) => [t.title, t]));
    expect(byTitle.get(plan.daily_tasks[0].title)!.resource_url).toBeNull();
    expect(byTitle.get(plan.daily_tasks[0].title)!.resource_query).toBeTruthy();
    expect(byTitle.get(plan.daily_tasks[1].title)!.resource_url).toBe("https://real.org/runner");
    expect(clean.daily_tasks.every((t) => t.estimated_minutes <= 45)).toBe(true);
    expect(clean.daily_tasks.every((t) => t.phase_index < clean.phases.length)).toBe(true);
    const perDay = new Map<number, number>();
    for (const t of clean.daily_tasks) perDay.set(t.day, (perDay.get(t.day) ?? 0) + t.estimated_minutes);
    for (const [, m] of perDay) expect(m).toBeLessThanOrEqual(45);
  });
});
