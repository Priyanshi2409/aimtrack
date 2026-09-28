import { NextResponse } from "next/server";
import { errorResponse, requireApiUser } from "@/lib/api";
import { aiProviderName, env } from "@/lib/env";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const MODELS = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.7-flash", "gemini-2.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"];

/** Signed-in diagnostics: which AI models and search actually respond from this server. No secrets returned. */
export async function GET() {
  try {
    await requireApiUser();
    const out: Record<string, unknown> = { provider: aiProviderName() };
    if (aiProviderName() === "gemini") {
      const results: Record<string, string> = {};
      for (const m of MODELS) {
        const t0 = Date.now();
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": env.geminiKey },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with the single word OK" }] }], generationConfig: { maxOutputTokens: 512 } }),
        });
        const body = await r.text();
        results[m] = `${r.status} in ${Date.now() - t0}ms${r.ok ? "" : ": " + body.slice(0, 160).replace(/\s+/g, " ")}`;
      }
      out.models = results;
    }
    if (env.tavilyKey) {
      const r = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.tavilyKey}` },
        body: JSON.stringify({ query: "half marathon training plan beginner", max_results: 1 }),
      });
      out.tavily = r.status;
    }
    return NextResponse.json(out);
  } catch (e) {
    return errorResponse(e);
  }
}
