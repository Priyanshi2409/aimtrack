import "server-only";

/**
 * Centralised, server-only environment access.
 * Nothing in here is ever sent to the browser except the two NEXT_PUBLIC_ values.
 */
export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  aiModelSmart: process.env.AI_MODEL_SMART || "claude-sonnet-5",
  aiModelFast: process.env.AI_MODEL_FAST || "claude-haiku-4-5-20251001",
  authSecret: process.env.AUTH_SECRET || "local-dev-secret-change-me",
  cronSecret: process.env.CRON_SECRET ?? "",
  demoEmail: process.env.DEMO_EMAIL || "demo@aimtrack.app",
  demoPassword: process.env.DEMO_PASSWORD || "aimtrack-demo-2026",
};

export const isSupabaseAuth = () => Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const isDbConfigured = () => Boolean(env.databaseUrl);
export const isAiLive = () => Boolean(env.anthropicKey);
