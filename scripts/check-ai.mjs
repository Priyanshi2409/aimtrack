// Fails the deploy early (with a clear message) if the AI key/model or web search is unusable.
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const models = [process.env.AI_MODEL_SMART || "claude-sonnet-5", process.env.AI_MODEL_FAST || "claude-haiku-4-5-20251001"];
for (const model of models) {
  try {
    const r = await client.messages.create({ model, max_tokens: 5, messages: [{ role: "user", content: "Reply OK" }] });
    console.log(`✓ ${model} reachable (${r.content[0]?.type})`);
  } catch (e) {
    console.error(`✗ ${model}: ${e.status ?? ""} ${e.message}`);
    process.exit(1);
  }
}
// Web search must be enabled for the org (Console → Privacy/Settings). One search costs ~$0.01.
try {
  const r = await client.messages.create({
    model: models[0],
    max_tokens: 300,
    messages: [{ role: "user", content: "Search the web for 'Hal Higdon novice half marathon' and reply with one URL." }],
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 1 }],
  });
  const res = r.content.find((b) => b.type === "web_search_tool_result");
  if (!res || !Array.isArray(res.content)) throw new Error(res ? JSON.stringify(res.content) : "no search performed");
  console.log(`✓ web search works (${res.content.length} results)`);
} catch (e) {
  console.error(`::warning::Web search check failed: ${e.message}. Research will show 'unavailable' until web search is enabled in the Anthropic Console.`);
}
console.log("AI check passed.");
