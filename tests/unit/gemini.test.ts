import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiProvider } from "@/lib/ai/gemini";

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const reply = (text: string) => ok({ candidates: [{ content: { parts: [{ text: "thinking…", thought: true }, { text }] } }] });

afterEach(() => vi.unstubAllGlobals());

describe("GeminiProvider", () => {
  it("falls back to the next model when one is unavailable, then remembers it", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(url);
      if (url.includes("gemini-3.5-flash-lite")) return new Response("model not found", { status: 404 });
      return reply("hello");
    });
    const p = new GeminiProvider("key", "tv");
    expect(await p.complete({ tier: "fast", system: "s", messages: [{ role: "user", content: "hi" }] })).toBe("hello");
    expect(await p.complete({ tier: "fast", system: "s", messages: [{ role: "user", content: "hi" }] })).toBe("hello");
    expect(calls.filter((c) => c.includes("3.5-flash-lite"))).toHaveLength(1);
    expect(calls[1]).toContain("gemini-3.1-flash-lite");
    expect(calls[2]).toContain("gemini-3.1-flash-lite");
  });

  it("parses server-sent-event streams and skips thought parts", async () => {
    const sse =
      'data: {"candidates":[{"content":{"parts":[{"text":"{\\"a\\":"}]}}]}\n\n' +
      'data: {"candidates":[{"content":{"parts":[{"text":"x","thought":true}]}}]}\n\n' +
      'data: {"candidates":[{"content":{"parts":[{"text":"1}"}]}}]}\n\n';
    vi.stubGlobal("fetch", async () => new Response(sse, { status: 200 }));
    const p = new GeminiProvider("key", "tv");
    let out = "";
    for await (const c of p.stream({ tier: "smart", system: "s", messages: [{ role: "user", content: "go" }] })) out += c;
    expect(out).toBe('{"a":1}');
  });

  it("searches with Tavily, reports progress, and returns only Tavily URLs as sources", async () => {
    let geminiPrompt = "";
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      if (url.includes("tavily")) {
        const q = JSON.parse(String(init.body)).query as string;
        return ok({ results: [{ url: `https://example.org/${encodeURIComponent(q)}`, title: q, content: "real page text" }] });
      }
      geminiPrompt = String(init.body);
      return reply('{"items":[],"note":null}');
    });
    const events: string[] = [];
    const p = new GeminiProvider("key", "tv");
    const r = await p.completeWithWebSearch({
      tier: "smart",
      system: "research",
      messages: [{ role: "user", content: "goal" }],
      maxSearches: 2,
      queries: ["q1", "q2", "q3"],
      onEvent: (e) => events.push(e.type),
    });
    expect(r.searchCount).toBe(2);
    expect(r.sources.map((s) => s.url)).toEqual(["https://example.org/q1", "https://example.org/q2"]);
    expect(events).toEqual(["search", "sources", "search", "sources", "status"]);
    expect(geminiPrompt).toContain("URL: https://example.org/q1");
  });

  it("retries on rate limits and surfaces a friendly error when they persist", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", async () => new Response('{"error":{"details":[{"retryDelay":"1s"}]}}', { status: 429 }));
    const p = new GeminiProvider("key", "tv", { smart: "gemini-x" });
    const pr = p.complete({ tier: "smart", system: "s", messages: [{ role: "user", content: "hi" }] });
    const assertion = expect(pr).rejects.toMatchObject({ code: "rate_limited" });
    await vi.runAllTimersAsync();
    await assertion;
    vi.useRealTimers();
  });
});
