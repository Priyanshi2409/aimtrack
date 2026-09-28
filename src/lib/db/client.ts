import "server-only";
import postgres from "postgres";
import { env } from "@/lib/env";

type Sql = postgres.Sql<Record<string, unknown>>;
export type Tx = postgres.TransactionSql<Record<string, unknown>>;

const globalForDb = globalThis as unknown as { __aimtrackSql?: Sql };

/** Single pooled connection per server instance (works with Supabase's transaction pooler). */
export function db(): Sql {
  if (!env.databaseUrl) throw new Error("DATABASE_URL is not configured");
  if (!globalForDb.__aimtrackSql) {
    globalForDb.__aimtrackSql = postgres(env.databaseUrl, {
      prepare: false, // required for PgBouncer transaction mode
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => {},
      transform: { undefined: null },
      types: {
        // Return DATE columns as plain 'YYYY-MM-DD' strings — no timezone surprises.
        date: { to: 1082, from: [1082], serialize: (x: unknown) => String(x), parse: (x: string) => x },
      },
    }) as unknown as Sql;
  }
  return globalForDb.__aimtrackSql!;
}

/**
 * Runs `fn` inside a transaction as the given user, with Postgres Row Level Security
 * enforced exactly as Supabase does it: role `authenticated` + JWT claims.
 * A bug in a query can therefore never leak or modify another user's rows.
 */
export async function withUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Invalid user id");
  const claims = JSON.stringify({ sub: userId, role: "authenticated" });
  return db().begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${claims}, true), set_config('request.jwt.claim.sub', ${userId}, true)`;
    await tx.unsafe("set local role authenticated");
    return fn(tx);
  }) as Promise<T>;
}
