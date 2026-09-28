// Deploy-time check: is the configured AI provider (and web search) usable? Prints the working models.
// Never fails the deploy for AI problems — the app falls back gracefully — but makes issues visible.
const { ANTHROPIC_API_KEY, GEMINI_API_KEY, TAVILY_API_KEY } = process.env;

async function checkGemini() {
  const models = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.7-flash", "gemini-2.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"];
  for (const auth of ["key", "bearer"]) {
    const headers = { "Content-Type": "application/json", ...(auth === "key" ? { "x-goog-api-key": GEMINI_API_KEY } : { Authorization: `Bearer ${GEMINI_API_KEY}` }) };
    const ok = [];
    for (const m of models) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: "POST",
        headers,
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with OK" }] }], generationConfig: { maxOutputTokens: 256 } }),
      });
      const t = await r.text();
      console.log(`  [${auth}] ${m}: ${r.status}${r.ok ? "" : " " + t.slice(0, 140).replace(/\s+/g, " ")}`);
      if (r.ok) ok.push(m);
      if (r.status === 401 || r.status === 403) break;
    }
    if (ok.length) return console.log(`✓ Gemini works with ${auth} auth. Models: ${ok.join(", ")}`);
  }
  console.log("::warning::Gemini key did not work with any model.");
}

async function checkTavily() {
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TAVILY_API_KEY}` },
    body: JSON.stringify({ query: "Hal Higdon novice half marathon plan", max_results: 2 }),
  });
  const d = await r.json().catch(() => ({}));
  if (r.ok) console.log(`✓ Tavily search works (${d.results?.length ?? 0} results)`);
  else console.log(`::warning::Tavily search failed: ${r.status} ${JSON.stringify(d).slice(0, 200)}`);
}

async function checkAnthropic() {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const model = process.env.AI_MODEL_FAST || "claude-haiku-4-5-20251001";
  try {
    await client.messages.create({ model, max_tokens: 5, messages: [{ role: "user", content: "OK" }] });
    console.log(`✓ Anthropic ${model} reachable`);
  } catch (e) {
    console.log(`::warning::Anthropic check failed: ${e.message}`);
  }
}

if (ANTHROPIC_API_KEY) await checkAnthropic();
else if (GEMINI_API_KEY) await checkGemini();
else console.log("No AI key configured: the app will run with offline templates.");
if (TAVILY_API_KEY) await checkTavily();
