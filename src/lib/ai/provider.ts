/**
 * Provider-agnostic AI interface. Everything above this file (agents, routes, UI)
 * talks only to `AIProvider`, so swapping Claude for another LLM means writing one
 * new implementation of this interface — nothing else changes.
 */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CompleteOptions {
  system: string;
  messages: ChatMessage[];
  /** "fast" = cheap model for chat/reviews, "smart" = stronger model for research/planning */
  tier: "fast" | "smart";
  maxTokens?: number;
  temperature?: number;
}

export interface SearchSource {
  url: string;
  title: string;
}

export interface SearchCompletion {
  text: string;
  /** Every URL the web-search tool actually returned — the ground truth for citations. */
  sources: SearchSource[];
  searchCount: number;
}

/** Live progress emitted while the research agent works (streamed to the UI). */
export type AgentEvent =
  | { type: "status"; text: string }
  | { type: "search"; query: string }
  | { type: "sources"; count: number; domains: string[] }
  | { type: "progress"; text: string; pct?: number };

export interface AIProvider {
  readonly id: string;
  complete(opts: CompleteOptions): Promise<string>;
  stream(opts: CompleteOptions): AsyncIterable<string>;
  completeWithWebSearch(
    opts: CompleteOptions & { maxSearches: number; onEvent?: (e: AgentEvent) => void; /** used by providers without a built-in search tool */ queries?: string[] },
  ): Promise<SearchCompletion>;
}

export type AIErrorCode =
  | "not_configured"
  | "rate_limited"
  | "overloaded"
  | "timeout"
  | "invalid_output"
  | "search_unavailable"
  | "quota"
  | "bad_request"
  | "unknown";

const FRIENDLY: Record<AIErrorCode, string> = {
  not_configured: "AI isn't configured on this server yet.",
  rate_limited: "The AI is getting too many requests right now. Please try again in a minute.",
  overloaded: "The AI service is busy at the moment. Please retry in a few seconds.",
  timeout: "The AI took too long to respond. Please try again.",
  invalid_output: "The AI returned something we couldn't understand, even after a retry. Please try again.",
  search_unavailable: "Live web search isn't available right now (search key missing, invalid or not enabled).",
  quota: "The free AI or search quota is used up for now. Please try again later.",
  bad_request: "The AI rejected this request. Try rephrasing your goal.",
  unknown: "Something went wrong talking to the AI. Please try again.",
};

export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly retryable: boolean;
  constructor(code: AIErrorCode, detail?: string) {
    super(detail ? `${FRIENDLY[code]} (${detail})` : FRIENDLY[code]);
    this.code = code;
    this.retryable = code === "rate_limited" || code === "overloaded" || code === "timeout" || code === "invalid_output";
  }
  get userMessage() {
    return FRIENDLY[this.code];
  }
}
