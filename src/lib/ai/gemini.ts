import "server-only";
import { AIError, type AgentEvent, type AIProvider, type CompleteOptions, type SearchCompletion, type SearchSource } from "./provider";
import { normalizeUrl } from "./urls";

/**
 * Free-tier friendly provider: Google Gemini for text + Tavily for web search.
 * Gemini's free tier has no built-in search grounding, so search is done explicitly
 * with Tavily and the model may only cite URLs that Tavily returned.
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta";

// Tried in order until one works for this key (free-tier model names change over time).
const CANDIDATES = {
  smart: ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.7-flash", "gemini-2.5-flash"],
  fast: ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-3.5-flash"],
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class GeminiProvider implements AIProvider {
  readonly id = "gemini";
  private working: Partial<Record<"smart" | "fast", string>> = {};
  private useBearer = false;

  constructor(
    private apiKey: string,
    private tavilyKey: string,
    private pinned: { smart?: string; fast?: string } = {},
  ) {}

  private models(tier: "smart" | "fast") {
    const w = this.working[tier];
    if (w) return [w];
    const pin = this.pinned[tier];
    return pin ? [pin, ...CANDIDATES[tier].filter((m) => m !== pin)] : CANDIDATES[tier];
  }

  private headers(): Record<string, string> {
    return this.useBearer
      ? { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` }
      : { "Content-Type": "application/json", "x-goog-api-key": this.apiKey };
  }

  private body(o: CompleteOptions) {
    return {
      systemInstruction: { parts: [{ text: o.system }] },
      contents: o.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      // Thinking models spend output tokens on reasoning, so leave generous headroom.
      generationConfig: { maxOutputTokens: Math.min(65536, (o.maxTokens ?? 2048) * 2 + 4096), temperature: o.temperature ?? 0.4 },
    };
  }

  /** POST with model fallback, auth-style fallback and 429/503 backoff. */
  private async post(tier: "smart" | "fast", action: string, body: unknown): Promise<Response> {
    let lastErr: AIError | null = null;
    for (const model of this.models(tier)) {
      for (let attempt = 0; attempt < 4; attempt++) {
        let res: Response;
        try {
          res = await fetch(`${BASE}/models/${model}:${action}`, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(180_000),
          });
        } catch (e) {
          lastErr = new AIError((e as Error).name === "TimeoutError" ? "timeout" : "unknown", (e as Error).message);
          await sleep(1500 * (attempt + 1));
          continue;
        }
        if (res.ok) {
          this.working[tier] = model;
          return res;
        }
        const text = await res.text().catch(() => "");
        if ((res.status === 401 || res.status === 403) && !this.useBearer && this.apiKey.startsWith("AQ.")) {
          this.useBearer = true; // newer Google key format may need bearer auth
          attempt--;
          continue;
        }
        if (res.status === 404 || (res.status === 400 && /model|not found|not supported/i.test(text))) {
          lastErr = new AIError("bad_request", `model ${model} unavailable`);
          break; // try next model
        }
        if (res.status === 429 || res.status === 503 || res.status === 500) {
          lastErr = new AIError(res.status === 429 ? "rate_limited" : "overloaded");
          const retry = Number(text.match(/"retryDelay":\s*"(\d+)/)?.[1] ?? 0);
          if (attempt < 3) {
            await sleep(Math.min(20_000, (retry || 2 ** attempt * 3) * 1000));
            continue;
          }
          throw lastErr;
        }
        if (res.status === 401 || res.status === 403) throw new AIError("not_configured", "Gemini key rejected");
        throw new AIError("bad_request", text.slice(0, 160));
      }
    }
    throw lastErr ?? new AIError("unknown");
  }

  async complete(o: CompleteOptions): Promise<string> {
    const res = await this.post(o.tier, "generateContent", this.body(o));
    const data = (await res.json()) as GeminiResponse;
    const text = textOf(data);
    if (!text && data.promptFeedback?.blockReason) throw new AIError("bad_request", `blocked: ${data.promptFeedback.blockReason}`);
    return text;
  }

  async *stream(o: CompleteOptions): AsyncIterable<string> {
    const res = await this.post(o.tier, "streamGenerateContent?alt=sse", this.body(o));
    if (!res.body) return;
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
        if (!line.startsWith("data:")) continue;
        try {
          const t = textOf(JSON.parse(line.slice(5)) as GeminiResponse);
          if (t) yield t;
        } catch {
          /* partial line */
        }
      }
    }
  }

  async completeWithWebSearch(o: CompleteOptions & { maxSearches: number; onEvent?: (e: AgentEvent) => void; queries?: string[] }): Promise<SearchCompletion> {
    if (!this.tavilyKey) throw new AIError("search_unavailable", "TAVILY_API_KEY missing");
    const emit = o.onEvent ?? (() => {});
    const queries = (o.queries ?? []).slice(0, o.maxSearches);
    const sources = new Map<string, SearchSource & { content: string }>();
    let searchCount = 0;
    for (const q of queries) {
      emit({ type: "search", query: q });
      const results = await tavily(this.tavilyKey, q);
      searchCount++;
      for (const r of results) if (!sources.has(normalizeUrl(r.url))) sources.set(normalizeUrl(r.url), { url: r.url, title: r.title, content: r.content });
      emit({ type: "sources", count: results.length, domains: [...new Set(results.map((r) => hostOf(r.url)))].slice(0, 6) });
    }
    if (sources.size === 0) return { text: '{"items":[],"note":"The web search returned no usable pages for this goal."}', sources: [], searchCount };

    emit({ type: "status", text: "Reading sources and writing findings" });
    const list = [...sources.values()].slice(0, 18);
    const block = list.map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.content.slice(0, 900)}`).join("\n\n");
    const text = await this.complete({
      ...o,
      system: `${o.system}\n\nIMPORTANT: You cannot browse. The web search has ALREADY been done for you; its results are given below. Use ONLY those results. Every source_url must be copied exactly from a "URL:" line.`,
      messages: [...o.messages, { role: "user", content: `Web search results:\n\n${block}\n\nNow reply with ONLY the JSON object.` }],
    });
    return { text, sources: list.map(({ url, title }) => ({ url, title })), searchCount };
  }
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  promptFeedback?: { blockReason?: string };
}

function textOf(d: GeminiResponse): string {
  return (d.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => p.text && !p.thought)
    .map((p) => p.text)
    .join("");
}

function hostOf(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

async function tavily(key: string, query: string): Promise<{ url: string; title: string; content: string }[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ query, search_depth: "basic", max_results: 6, include_answer: false }),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status === 401 || res.status === 403) throw new AIError("search_unavailable", "Tavily key rejected");
      if (res.status === 429 || res.status === 432 || res.status === 433) throw new AIError("quota", "Tavily search credits used up for this month");
      if (!res.ok) throw new Error(`Tavily ${res.status}`);
      const data = (await res.json()) as { results?: { url: string; title: string; content: string }[] };
      return (data.results ?? []).filter((r) => /^https?:\/\//.test(r.url));
    } catch (e) {
      if (e instanceof AIError) throw e;
      if (attempt === 2) throw new AIError("search_unavailable", (e as Error).message);
      await sleep(1500 * (attempt + 1));
    }
  }
  return [];
}
