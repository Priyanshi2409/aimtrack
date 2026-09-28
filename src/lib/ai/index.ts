import "server-only";
import { aiProviderName, env } from "@/lib/env";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import { AIError, type AIProvider } from "./provider";

let cached: AIProvider | null | undefined;

/**
 * The single place the app decides which LLM to use. Returns null when no key is
 * configured; callers then fall back to the clearly-labelled offline templates.
 * To add another provider: implement AIProvider and select it here (e.g. by AI_PROVIDER env).
 */
export function getProvider(): AIProvider | null {
  if (cached !== undefined) return cached;
  const which = aiProviderName();
  cached =
    which === "anthropic"
      ? new AnthropicProvider(env.anthropicKey, { smart: env.aiModelSmart, fast: env.aiModelFast })
      : which === "gemini"
        ? new GeminiProvider(env.geminiKey, env.tavilyKey, { smart: env.geminiModelSmart || undefined, fast: env.geminiModelFast || undefined })
        : null;
  return cached;
}

export function requireProvider(): AIProvider {
  const p = getProvider();
  if (!p) throw new AIError("not_configured");
  return p;
}

export { AIError };
