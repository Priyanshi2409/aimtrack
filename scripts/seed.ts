/**
 * Seeds the shared demo account with realistic sample goals and history.
 * Run: npm run seed   (uses DATABASE_URL, and Supabase admin keys when present)
 */
import "dotenv/config";
import { db } from "@/lib/db/client";
import { reseedDemo } from "@/lib/seed/demo";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set — skipping demo seed.");
    return;
  }
  const r = await reseedDemo();
  console.log(`✓ Demo account ready (${r.goals} sample goals)`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => db().end({ timeout: 5 }).catch(() => {}));
