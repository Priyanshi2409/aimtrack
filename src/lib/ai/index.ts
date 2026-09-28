import "server-only";
import { env } from "@/lib/env";
import { AnthropicProvider } from "./anthropic";
import { AIError, type AIProvider } from "./provider";

let cached: AIProvider | null | undefined;

/**
 * The single place the app decides which LLM to use. Returns null when no key is
 * configured; callers then fall back to the clearly-labelled offline templates.
 * To add another provider: implement AIProvider and select it here (e.g. by AI_PROVIDER env).
 */
export function getProvider(): AIProvider | null {
  if (cached !== undefined) return cached;
  cached = env.anthropicKey ? new AnthropicProvider(env.anthropicKey, { smart: env.aiModelSmart, fast: env.aiModelFast }) : null;
  return cached;
}

export function requireProvider(): AIProvider {
  const p = getProvider();
  if (!p) throw new AIError("not_configured");
  return p;
}

export { AIError };
