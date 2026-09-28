"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Globe, Loader2, RotateCcw, Search, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FindingCard, KIND_META } from "@/components/app/research-cards";
import { VerdictBadge } from "@/components/app/widgets";
import { Button } from "@/components/ui/button";
import { Badge, Card, Input, Label, Progress, Textarea } from "@/components/ui/primitives";
import { addDays, diffDays, formatDate, formatMinutes } from "@/lib/core/dates";
import type { Feasibility, ResearchFinding, ResearchKind, ResearchRun } from "@/lib/types";
import { cn } from "@/lib/utils";

type Step = "goal" | "details" | "research" | "reality" | "plan";
const STEPS: { id: Step; label: string }[] = [
  { id: "goal", label: "Goal" },
  { id: "details", label: "Details" },
  { id: "research", label: "Research" },
  { id: "reality", label: "Reality check" },
  { id: "plan", label: "Plan" },
];
const KINDS: ResearchKind[] = ["examples", "requirements", "pitfalls"];
const EXAMPLES = ["Crack a PM internship in 6 months", "Run a half marathon by March", "Open a café in Indore within 3 years", "Get to conversational Japanese in a year", "Save ₹2 lakh for a Europe trip by next summer"];

interface Question {
  id: string;
  question: string;
  placeholder?: string;
  options?: string[];
}
interface AgentLog {
  status: "idle" | "running" | "done" | "error";
  lines: { kind: "status" | "search" | "sources" | "progress"; text: string }[];
  findings: ResearchFinding[];
  run?: ResearchRun;
  error?: string;
}
export interface ResumeState {
  goalId: string;
  title: string;
  deadline: string | null;
  minutes: number;
  hasResearch: ResearchKind[];
  feasibility: Feasibility | null;
  findings: ResearchFinding[];
  runs: ResearchRun[];
}

async function readNdjson(res: Response, onLine: (o: Record<string, unknown>) => void) {
  if (!res.body) throw new Error("No response body");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) onLine(JSON.parse(line));
    }
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed. Please try again.");
  return data as T;
}

export function GoalWizard({ today, resume }: { today: string; resume?: ResumeState | null }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(resume ? (resume.feasibility ? "reality" : "research") : "goal");
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [sequential, setSequential] = useState(true); // safe default; clarify tells us if parallel is fine

  // details
  const [title, setTitle] = useState(resume?.title ?? "");
  const [category, setCategory] = useState("personal");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [deadline, setDeadline] = useState<string>(resume?.deadline ?? addDays(today, 90));
  const [minutes, setMinutes] = useState(resume?.minutes ?? 60);
  const [start, setStart] = useState<"today" | "tomorrow">("today");

  // research / reality / plan
  const [goalId, setGoalId] = useState<string | null>(resume?.goalId ?? null);
  const [agents, setAgents] = useState<Record<ResearchKind, AgentLog>>(() =>
    Object.fromEntries(
      KINDS.map((k) => [
        k,
        resume?.hasResearch.includes(k)
          ? { status: "done", lines: [{ kind: "status", text: "Using saved research" }], findings: resume.findings.filter((f) => f.kind === k), run: resume.runs.find((r) => r.kind === k) }
          : { status: "idle", lines: [], findings: [] },
      ]),
    ) as Record<ResearchKind, AgentLog>,
  );
  const [feasibility, setFeasibility] = useState<Feasibility | null>(resume?.feasibility ?? null);
  const [chosenDeadline, setChosenDeadline] = useState<string | null>(resume?.deadline ?? null);
  const [planStage, setPlanStage] = useState<{ text: string; pct: number }>({ text: "Starting", pct: 2 });
  const startedResearch = useRef(false);

  // ── step 1 → 2
  const submitGoal = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await postJson<{ title: string; category: string; questions: Question[]; suggested_deadline: string | null; suggested_minutes_per_day: number; live: boolean; sequential?: boolean }>(
        "/api/goals/clarify",
        { raw },
      );
      setTitle(r.title);
      setCategory(r.category);
      setQuestions(r.questions);
      if (r.suggested_deadline && r.suggested_deadline > today) setDeadline(r.suggested_deadline);
      setMinutes(r.suggested_minutes_per_day);
      setLive(r.live);
      setSequential(r.sequential ?? true);
      setStep("details");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // ── step 2 → 3
  const createGoal = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await postJson<{ id: string }>("/api/goals", {
        raw,
        title,
        category,
        answers: questions.map((q) => ({ id: q.id, question: q.question, answer: answers[q.id] ?? "" })),
        deadline,
        minutes_per_day: minutes,
        start,
      });
      setGoalId(r.id);
      setChosenDeadline(deadline);
      setStep("research");
      // Update the URL (so a refresh resumes here) without remounting the wizard.
      window.history.replaceState(null, "", `/goals/new?resume=${r.id}`);
      router.refresh(); // show the new goal in the sidebar (client state is preserved)
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const runAgent = useCallback(
    async (kind: ResearchKind, refresh = false) => {
      if (!goalId) return;
      setAgents((a) => ({ ...a, [kind]: { status: "running", lines: [], findings: [] } }));
      const push = (line: AgentLog["lines"][number]) => setAgents((a) => ({ ...a, [kind]: { ...a[kind], lines: [...a[kind].lines, line].slice(-8) } }));
      try {
        const res = await fetch(`/api/goals/${goalId}/research`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, refresh }) });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error ?? "Research failed");
        }
        await readNdjson(res, (o) => {
          if (o.type === "search") push({ kind: "search", text: String(o.query) });
          else if (o.type === "sources") push({ kind: "sources", text: `Found ${o.count} pages: ${(o.domains as string[]).join(", ")}` });
          else if (o.type === "status" || o.type === "progress") push({ kind: o.type as "status", text: String(o.text) });
          else if (o.type === "done") {
            if (o.live === false) setLive(false);
            setAgents((a) => ({ ...a, [kind]: { ...a[kind], status: "done", findings: o.findings as ResearchFinding[], run: o.run as ResearchRun } }));
          } else if (o.type === "error") throw new Error(String(o.error));
        });
      } catch (e) {
        setAgents((a) => ({ ...a, [kind]: { ...a[kind], status: "error", error: (e as Error).message } }));
      }
    },
    [goalId],
  );

  // Auto-start research agents in parallel on entering the research step.
  useEffect(() => {
    if (step !== "research" || !goalId || startedResearch.current) return;
    startedResearch.current = true;
    const todo = KINDS.filter((k) => agents[k].status === "idle");
    if (sequential) {
      (async () => {
        for (const k of todo) await runAgent(k);
      })();
    } else {
      todo.forEach((k) => runAgent(k));
    }
  }, [step, goalId, agents, runAgent, sequential]);

  const allDone = KINDS.every((k) => agents[k].status === "done");
  const anyError = KINDS.some((k) => agents[k].status === "error");

  const runReality = async () => {
    if (!goalId) return;
    setError(null);
    setBusy(true);
    try {
      const r = await postJson<{ feasibility: Feasibility; live: boolean; deadline: string | null }>(`/api/goals/${goalId}/reality`, {});
      setFeasibility(r.feasibility);
      setLive(r.live);
      setChosenDeadline(r.deadline);
      setStep("reality");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const buildPlan = async () => {
    if (!goalId) return;
    setError(null);
    setStep("plan");
    setPlanStage({ text: "Starting", pct: 2 });
    try {
      const res = await fetch(`/api/goals/${goalId}/plan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deadline: chosenDeadline }) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Plan generation failed");
      }
      let finished = false;
      await readNdjson(res, (o) => {
        if (o.type === "progress") setPlanStage((s) => ({ text: String(o.text), pct: typeof o.pct === "number" ? o.pct : s.pct }));
        if (o.type === "error") throw new Error(String(o.error));
        if (o.type === "done") finished = true;
      });
      if (!finished) throw new Error("The connection dropped before the plan was saved. Please retry.");
      setPlanStage({ text: "Done! Opening your roadmap", pct: 100 });
      router.push(`/goals/${goalId}?created=1`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const stepIdx = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Stepper */}
      <ol className="mb-8 flex items-center gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold transition",
                i < stepIdx ? "border-volt bg-volt text-volt-fg" : i === stepIdx ? "border-volt-strong text-fg" : "border-border text-subtle",
              )}
              aria-current={i === stepIdx ? "step" : undefined}
            >
              {i < stepIdx ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn("hidden text-xs font-medium sm:block", i === stepIdx ? "text-fg" : "text-subtle")}>{s.label}</span>
            {i < STEPS.length - 1 && <span className={cn("h-px flex-1", i < stepIdx ? "bg-volt" : "bg-border")} />}
          </li>
        ))}
      </ol>

      {!live && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-iris/30 bg-iris-soft px-3 py-2.5 text-xs text-iris">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          Offline mode: no AI key is configured on this server, so AimTrack uses simple templates and does no web research. Nothing is made up.
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
          {step === "goal" && (
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">What do you want to achieve?</h1>
              <p className="mt-2 text-muted">Write it the way you&apos;d say it to a friend. Short-term or long-term, both work.</p>
              <form
                className="mt-8"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (raw.trim().length >= 8) submitGoal();
                }}
              >
                <Textarea
                  autoFocus
                  rows={3}
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && raw.trim().length >= 8) {
                      e.preventDefault();
                      submitGoal();
                    }
                  }}
                  maxLength={500}
                  placeholder="e.g. Crack a PM internship in 6 months"
                  className="text-lg"
                  aria-label="Your goal"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {EXAMPLES.map((ex) => (
                    <button key={ex} type="button" onClick={() => setRaw(ex)} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted transition hover:border-border-strong hover:text-fg">
                      {ex}
                    </button>
                  ))}
                </div>
                <ErrorBox error={error} />
                <div className="mt-8 flex justify-end">
                  <Button type="submit" size="lg" loading={busy} disabled={raw.trim().length < 8}>
                    Continue <ArrowRight />
                  </Button>
                </div>
              </form>
            </div>
          )}

          {step === "details" && (
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">A few quick questions</h1>
              <p className="mt-2 text-muted">These change the plan the most. Skip anything you&apos;re unsure about.</p>
              <div className="mt-8 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Goal title</Label>
                  <Input id="title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
                </div>
                {questions.map((q) => (
                  <div key={q.id} className="space-y-2">
                    <Label htmlFor={`q-${q.id}`} className="normal-case tracking-normal text-sm text-fg">
                      {q.question}
                    </Label>
                    {q.options?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {q.options.map((o) => (
                          <button
                            key={o}
                            type="button"
                            onClick={() => setAnswers((a) => ({ ...a, [q.id]: a[q.id] === o ? "" : o }))}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-sm transition",
                              answers[q.id] === o ? "border-volt-strong bg-volt-soft text-fg" : "border-border text-muted hover:border-border-strong hover:text-fg",
                            )}
                            aria-pressed={answers[q.id] === o}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <Input
                      id={`q-${q.id}`}
                      value={q.options?.includes(answers[q.id] ?? "") ? "" : (answers[q.id] ?? "")}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                      placeholder={q.options?.length ? "Or type your own answer" : (q.placeholder ?? "Your answer")}
                      maxLength={400}
                    />
                  </div>
                ))}

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="deadline">Deadline</Label>
                    <Input id="deadline" type="date" min={addDays(today, 1)} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                    <p className="text-xs text-subtle">{deadline > today ? `${Math.round(diffDays(deadline, today) / 7)} weeks from today` : "Pick a future date"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minutes">Time per day: {formatMinutes(minutes)}</Label>
                    <input
                      id="minutes"
                      type="range"
                      min={15}
                      max={240}
                      step={15}
                      value={minutes}
                      onChange={(e) => setMinutes(Number(e.target.value))}
                      className="mt-3 w-full accent-[var(--volt-strong)]"
                    />
                    <p className="text-xs text-subtle">Be honest. A plan that fits your real life beats an ambitious one you abandon.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Start</Label>
                  <div className="flex gap-2">
                    {(["today", "tomorrow"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStart(s)}
                        className={cn("rounded-xl border px-4 py-2 text-sm capitalize", start === s ? "border-volt-strong bg-volt-soft" : "border-border text-muted")}
                        aria-pressed={start === s}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <ErrorBox error={error} />
              <div className="mt-8 flex justify-between">
                <Button variant="ghost" onClick={() => setStep("goal")}>
                  <ArrowLeft /> Back
                </Button>
                <Button size="lg" loading={busy} onClick={createGoal} disabled={title.trim().length < 3 || deadline <= today}>
                  <Search /> Research this goal
                </Button>
              </div>
            </div>
          )}

          {step === "research" && (
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Researching how people actually did it</h1>
              <p className="mt-2 text-muted">Three research agents search the web. Every claim must link to a page they actually read, or it gets dropped.</p>
              <div className="mt-8 space-y-3">
                {KINDS.map((k) => (
                  <AgentRow key={k} kind={k} log={agents[k]} onRetry={() => runAgent(k, true)} />
                ))}
              </div>
              {allDone && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 space-y-6">
                  {KINDS.map((k) =>
                    agents[k].findings.length ? (
                      <div key={k}>
                        <h3 className="mb-2 text-sm font-semibold">{KIND_META[k].label}</h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {agents[k].findings.slice(0, 4).map((f) => (
                            <FindingCard key={f.id} f={f} />
                          ))}
                        </div>
                      </div>
                    ) : null,
                  )}
                </motion.div>
              )}
              <ErrorBox error={error} />
              <div className="sticky bottom-20 mt-8 flex justify-end lg:bottom-4">
                <Button size="lg" loading={busy} disabled={!allDone && !anyError} onClick={runReality} className="shadow-2xl">
                  {allDone ? (
                    <>
                      Run reality check <ArrowRight />
                    </>
                  ) : anyError ? (
                    <>Continue with what we found</>
                  ) : (
                    <>
                      <Loader2 className="animate-spin" /> Researching…
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === "reality" && feasibility && (
            <RealityStep
              f={feasibility}
              today={today}
              current={chosenDeadline}
              onChoose={setChosenDeadline}
              chosen={chosenDeadline}
              onBack={() => setStep("research")}
              onBuild={buildPlan}
              error={error}
            />
          )}

          {step === "plan" && (
            <div className="py-10 text-center">
              <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-volt-soft text-volt-strong">
                {error ? <AlertCircle className="size-7 text-danger" /> : <Wand2 className="size-7 animate-pulse" />}
              </div>
              <h1 className="mt-6 text-2xl font-semibold tracking-tight">{error ? "The plan didn't come through" : "Building your roadmap"}</h1>
              {!error && (
                <>
                  <p className="mt-2 text-muted" aria-live="polite">
                    {planStage.text}…
                  </p>
                  <div className="mx-auto mt-8 max-w-md">
                    <Progress value={planStage.pct} label="Plan generation progress" />
                  </div>
                  <p className="mt-4 text-xs text-subtle">Goal → phases → milestones → weekly targets → daily tasks. This usually takes 30–90 seconds.</p>
                </>
              )}
              <ErrorBox error={error} />
              {error && (
                <div className="mt-6 flex justify-center gap-3">
                  <Button variant="ghost" onClick={() => { setError(null); setStep("reality"); }}>
                    <ArrowLeft /> Back
                  </Button>
                  <Button onClick={buildPlan}>
                    <RotateCcw /> Try again
                  </Button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
      <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
    </div>
  );
}

function AgentRow({ kind, log, onRetry }: { kind: ResearchKind; log: AgentLog; onRetry: () => void }) {
  const meta = KIND_META[kind];
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={cn("grid size-9 place-items-center rounded-xl", meta.tone)}>
          <meta.icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{meta.label}</div>
          <div className="truncate text-xs text-subtle" aria-live="polite">
            {log.status === "running" && (log.lines.at(-1)?.text ?? "Starting agent")}
            {log.status === "done" && (log.findings.length ? `${log.findings.length} verified finding${log.findings.length > 1 ? "s" : ""}` : "No reliable sources found (left empty, not guessed)")}
            {log.status === "error" && <span className="text-danger">{log.error}</span>}
            {log.status === "idle" && "Waiting"}
          </div>
        </div>
        {log.status === "running" && <Loader2 className="size-4 animate-spin text-muted" />}
        {log.status === "done" && (
          <Badge tone="volt">
            <ShieldCheck className="size-3" /> Done
          </Badge>
        )}
        {log.status === "error" && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            <RotateCcw /> Retry
          </Button>
        )}
      </div>
      {(log.status === "running" || (log.status === "done" && log.lines.length > 1)) && (
        <ul className="space-y-1 border-t border-border bg-surface-2/50 px-4 py-2.5 font-mono text-[11px]">
          <AnimatePresence initial={false}>
            {log.lines.map((l, i) => (
              <motion.li key={i + l.text} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-2 text-muted">
                {l.kind === "search" ? <Search className="mt-0.5 size-3 shrink-0 text-sky" /> : l.kind === "sources" ? <Globe className="mt-0.5 size-3 shrink-0 text-volt-strong" /> : <Sparkles className="mt-0.5 size-3 shrink-0 text-iris" />}
                <span className="break-all">{l.kind === "search" ? `Searching: "${l.text}"` : l.text}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const r = 70;
  const c = Math.PI * r;
  const v = Math.max(0, Math.min(100, score));
  const color = v >= 70 ? "var(--volt-strong)" : v >= 45 ? "var(--sky)" : v >= 30 ? "var(--ember)" : "var(--danger)";
  return (
    <svg viewBox="0 0 180 100" className="w-48" role="img" aria-label={`Feasibility score ${Math.round(v)} out of 100`}>
      <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="var(--surface-3)" strokeWidth="12" strokeLinecap="round" />
      <motion.path
        d="M 20 90 A 70 70 0 0 1 160 90"
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c - (v / 100) * c }}
        transition={{ duration: 1.1, ease: "easeOut" }}
      />
      <text x="90" y="84" textAnchor="middle" className="fill-fg font-mono text-[32px] font-semibold">
        {Math.round(v)}
      </text>
    </svg>
  );
}

function RealityStep({
  f,
  today,
  current,
  chosen,
  onChoose,
  onBack,
  onBuild,
  error,
}: {
  f: Feasibility;
  today: string;
  current: string | null;
  chosen: string | null;
  onChoose: (d: string | null) => void;
  onBack: () => void;
  onBuild: () => void;
  error: string | null;
}) {
  const [original] = useState(current);
  const [custom, setCustom] = useState(current ?? addDays(today, 90));
  const suggested = f.suggested_deadline && f.suggested_deadline > today && f.suggested_deadline !== original ? f.suggested_deadline : null;
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Reality check</h1>
      <p className="mt-2 text-muted">An honest read before we plan. No sugar-coating.</p>
      <Card className="mt-8 p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center">
            <ScoreGauge score={f.score} />
            <VerdictBadge verdict={f.verdict} />
          </div>
          <ul className="flex-1 space-y-3">
            {f.reasons.map((r, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-volt-strong" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <div className="mt-6 space-y-2">
        <Label>Deadline for the plan</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {original && (
            <DeadlineOption active={chosen === original} onClick={() => onChoose(original)} title="Keep my deadline" sub={formatDate(original, { day: "numeric", month: "short", year: "numeric" })} />
          )}
          {suggested && (
            <DeadlineOption
              active={chosen === suggested}
              onClick={() => onChoose(suggested)}
              title="Use suggested"
              sub={`${formatDate(suggested, { day: "numeric", month: "short", year: "numeric" })} · recommended`}
              highlight
            />
          )}
          <label className={cn("flex flex-col gap-1 rounded-xl border px-4 py-3 text-left", chosen === custom && chosen !== original && chosen !== suggested ? "border-volt-strong bg-volt-soft" : "border-border")}>
            <span className="text-sm font-medium">Custom date</span>
            <input
              type="date"
              min={addDays(today, 7)}
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                onChoose(e.target.value);
              }}
              className="bg-transparent text-xs text-muted"
            />
          </label>
        </div>
      </div>
      <ErrorBox error={error} />
      <div className="mt-8 flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft /> Research
        </Button>
        <Button size="lg" onClick={onBuild} disabled={!chosen || chosen <= today}>
          <Wand2 /> Build my plan
        </Button>
      </div>
    </div>
  );
}

function DeadlineOption({ active, onClick, title, sub, highlight }: { active: boolean; onClick: () => void; title: string; sub: string; highlight?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("rounded-xl border px-4 py-3 text-left transition", active ? "border-volt-strong bg-volt-soft" : "border-border hover:border-border-strong")}
    >
      <div className="text-sm font-medium">
        {title} {highlight && <Sparkles className="inline size-3 text-volt-strong" />}
      </div>
      <div className="text-xs text-muted">{sub}</div>
    </button>
  );
}
