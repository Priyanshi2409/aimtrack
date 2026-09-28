import type { z } from "zod";
import { AIError, type AIProvider, type CompleteOptions } from "./provider";

/** Pulls the JSON object out of a model reply (tolerates ```json fences and prose around it). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) throw new SyntaxError("No JSON object found in the response");
  return JSON.parse(candidate.slice(start, end + 1));
}

export function formatZodError(err: z.ZodError): string {
  return err.issues
    .slice(0, 8)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

/** Parse + validate. Returns either data or a precise error string to feed back to the model. */
export function parseStructured<T extends z.ZodTypeAny>(schema: T, text: string): { ok: true; data: z.infer<T> } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = extractJson(text);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: `Schema validation failed: ${formatZodError(parsed.error)}` };
  return { ok: true, data: parsed.data };
}

/**
 * Asks the model for JSON matching `schema`. On invalid output it retries exactly once,
 * sending back the validation error so the model can correct itself; after that it
 * throws AIError("invalid_output") which the UI turns into a friendly message.
 */
export async function generateStructured<T extends z.ZodTypeAny>(
  provider: AIProvider,
  schema: T,
  opts: CompleteOptions,
): Promise<z.infer<T>> {
  const first = await provider.complete(opts);
  const r1 = parseStructured(schema, first);
  if (r1.ok) return r1.data;

  const retry = await provider.complete({
    ...opts,
    messages: [
      ...opts.messages,
      { role: "assistant", content: first.slice(0, 12000) },
      {
        role: "user",
        content: `Your previous reply could not be used. ${r1.error}\nReturn ONLY the corrected JSON object — no prose, no code fences.`,
      },
    ],
  });
  const r2 = parseStructured(schema, retry);
  if (r2.ok) return r2.data;
  throw new AIError("invalid_output", r2.error.slice(0, 200));
}

/**
 * Same contract as generateStructured, but streams the first attempt so the UI can show
 * live progress (e.g. "Designing phase 3…") while a long JSON document is written.
 */
export async function generateStructuredStreaming<T extends z.ZodTypeAny>(
  provider: AIProvider,
  schema: T,
  opts: CompleteOptions,
  onText: (snapshot: string) => void,
): Promise<z.infer<T>> {
  let first = "";
  let lastEmit = 0;
  for await (const chunk of provider.stream(opts)) {
    first += chunk;
    if (first.length - lastEmit > 200) {
      lastEmit = first.length;
      onText(first);
    }
  }
  const r1 = parseStructured(schema, first);
  if (r1.ok) return r1.data;
  const retry = await provider.complete({
    ...opts,
    messages: [
      ...opts.messages,
      { role: "assistant", content: first.slice(0, 12000) },
      { role: "user", content: `Your previous reply could not be used. ${r1.error}\nReturn ONLY the corrected JSON object — no prose, no code fences.` },
    ],
  });
  const r2 = parseStructured(schema, retry);
  if (r2.ok) return r2.data;
  throw new AIError("invalid_output", r2.error.slice(0, 200));
}
