#!/usr/bin/env bash
# Build command used on Vercel: migrate the database and refresh the demo account, then build.
# Database/seed problems are logged but never block the deploy.
set -u
if [ -n "${DATABASE_URL:-}" ]; then
  node scripts/migrate.mjs || echo "⚠ migrations failed (see above)"
  npx tsx --conditions=react-server scripts/seed.ts || echo "⚠ demo seed failed (see above)"
else
  echo "DATABASE_URL not set: skipping migrations and demo seed"
fi
node scripts/check-ai.mjs || true
exec npx next build
