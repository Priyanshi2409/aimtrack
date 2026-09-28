import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { normalizeUrl } from "./urls";
import { AIError, type AgentEvent, type AIProvider, type CompleteOptions, type SearchCompletion, type SearchSource } from "./provider";

/** Claude implementation of AIProvider (Messages API + server-side web search tool). */
export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic";
  private client: Anthropic;

  constructor(
    apiKey: string,
    private models: { smart: string; fast: string },
  ) {
    // SDK retries 429/5xx/timeouts with exponential backoff; we add friendly mapping on top.
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 240_000 });
  }

  private model(tier: CompleteOptions["tier"]) {
    return tier === "smart" ? this.models.smart : this.models.fast;
  }

  async complete(o: CompleteOptions): Promise<string> {
    try {
      const res = await this.client.messages.create({
        model: this.model(o.tier),
        max_tokens: o.maxTokens ?? 2048,
        system: o.system,
        messages: o.messages,
      });
      return textOf(res.content);
    } catch (e) {
      throw mapError(e);
    }
  }

  async *stream(o: CompleteOptions): AsyncIterable<string> {
    let stream;
    try {
      stream = this.client.messages.stream({
        model: this.model(o.tier),
        max_tokens: o.maxTokens ?? 1200,
        system: o.system,
        messages: o.messages,
      });
    } catch (e) {
      throw mapError(e);
    }
    try {
      for await (const ev of stream) {
        if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") yield ev.delta.text;
      }
    } catch (e) {
      throw mapError(e);
    }
  }

  async completeWithWebSearch(o: CompleteOptions & { maxSearches: number; onEvent?: (e: AgentEvent) => void }): Promise<SearchCompletion> {
    const sources = new Map<string, SearchSource>();
    let searchCount = 0;
    let text = "";
    let searchErrors = 0;
    const emit = o.onEvent ?? (() => {});
    // Server tools can return stop_reason "pause_turn" on long searches; we continue the turn.
    const messages: Anthropic.MessageParam[] = o.messages.map((m) => ({ role: m.role, content: m.content }));
    try {
      for (let round = 0; round < 4; round++) {
        const stream = this.client.messages.stream({
          model: this.model(o.tier),
          max_tokens: o.maxTokens ?? 4096,
          system: o.system,
          messages,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: o.maxSearches }],
        });
        let wroteStatus = false;
        stream.on("contentBlock", (block) => {
          if (block.type === "server_tool_use") {
            searchCount++;
            const q = (block.input as { query?: string })?.query;
            if (q) emit({ type: "search", query: q });
          }
          if (block.type === "web_search_tool_result") {
            if (Array.isArray(block.content)) {
              for (const r of block.content) sources.set(normalizeUrl(r.url), { url: r.url, title: r.title });
              emit({ type: "sources", count: block.content.length, domains: [...new Set(block.content.map((r) => hostOf(r.url)))].slice(0, 6) });
            } else {
              searchErrors++;
            }
          }
        });
        stream.on("text", () => {
          if (!wroteStatus && searchCount > 0) {
            wroteStatus = true;
            emit({ type: "status", text: "Reading sources and writing findings" });
          }
        });
        const res = await stream.finalMessage();
        for (const block of res.content) {
          if (block.type === "text") {
            text += block.text;
            for (const c of block.citations ?? []) {
              if (c.type === "web_search_result_location") sources.set(normalizeUrl(c.url), { url: c.url, title: c.title ?? c.url });
            }
          }
        }
        if (res.stop_reason !== "pause_turn") break;
        messages.push({ role: "assistant", content: res.content as Anthropic.ContentBlockParam[] });
      }
    } catch (e) {
      throw mapError(e);
    }
    if (searchCount > 0 && sources.size === 0 && searchErrors > 0) throw new AIError("search_unavailable");
    return { text, sources: [...sources.values()], searchCount };
  }
}

function hostOf(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function mapError(e: unknown): AIError {
  if (e instanceof AIError) return e;
  if (e instanceof Anthropic.APIConnectionTimeoutError) return new AIError("timeout");
  if (e instanceof Anthropic.RateLimitError) return new AIError("rate_limited");
  if (e instanceof Anthropic.APIError) {
    const msg = String((e as { message?: string }).message ?? "");
    if (e.status === 529 || e.status === 503) return new AIError("overloaded");
    if (e.status === 401 || e.status === 403) return new AIError("not_configured", "invalid API key");
    if (e.status === 400 && /web.?search/i.test(msg)) return new AIError("search_unavailable");
    if (e.status === 400 && /credit|billing|balance/i.test(msg)) return new AIError("quota");
    if (e.status === 400) return new AIError("bad_request", msg.slice(0, 160));
    if (e.status && e.status >= 500) return new AIError("overloaded");
  }
  if (e instanceof Anthropic.APIConnectionError) return new AIError("timeout", "connection failed");
  return new AIError("unknown", e instanceof Error ? e.message.slice(0, 160) : undefined);
}
