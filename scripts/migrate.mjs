#!/usr/bin/env node
// Applies SQL files in supabase/migrations in order, once each.
// Usage: DATABASE_URL=... node scripts/migrate.mjs [--local-bootstrap]
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set — skipping migrations.");
  process.exit(process.argv.includes("--required") ? 1 : 0);
}

const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
const dir = path.join(process.cwd(), "supabase", "migrations");

try {
  if (process.argv.includes("--local-bootstrap")) {
    await sql.unsafe(await readFile(path.join(process.cwd(), "supabase", "local-bootstrap.sql"), "utf8"));
    console.log("✓ local bootstrap applied");
  }
  await sql`create table if not exists public._migrations (name text primary key, applied_at timestamptz default now())`;
  const applied = new Set((await sql`select name from public._migrations`).map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const body = await readFile(path.join(dir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into public._migrations (name) values (${file})`;
    });
    console.log(`✓ applied ${file}`);
  }
  console.log("Migrations up to date.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
