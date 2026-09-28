#!/usr/bin/env bash
# Creates (if needed) the Vercel project, makes production public, and upserts env vars.
# Uses only the Vercel REST API, so the whole deploy is reproducible from CI.
set -euo pipefail
API=https://api.vercel.com
AUTH="Authorization: Bearer ${VERCEL_TOKEN:?VERCEL_TOKEN missing}"
NAME=${VERCEL_PROJECT_NAME:-aimtrack}

USER_JSON=$(curl -fsS -H "$AUTH" "$API/v2/user")
TEAM=$(echo "$USER_JSON" | jq -r '.user.defaultTeamId // empty')
USER_ID=$(echo "$USER_JSON" | jq -r '.user.id')
Q=""; [ -n "$TEAM" ] && Q="teamId=$TEAM"

PROJ=$(curl -sS -H "$AUTH" "$API/v9/projects/$NAME?$Q")
if [ "$(echo "$PROJ" | jq -r '.id // empty')" = "" ]; then
  echo "Creating Vercel project $NAME"
  PROJ=$(curl -fsS -X POST -H "$AUTH" -H "Content-Type: application/json" "$API/v11/projects?$Q" \
    -d "{\"name\":\"$NAME\",\"framework\":\"nextjs\"}")
fi
PID=$(echo "$PROJ" | jq -r '.id')
echo "Project: $PID"

# Public production (no Vercel login wall) — the app has its own auth.
curl -fsS -X PATCH -H "$AUTH" -H "Content-Type: application/json" "$API/v9/projects/$PID?$Q" \
  -d '{"ssoProtection":null,"framework":"nextjs"}' > /dev/null

upsert() {
  local key=$1 val=${2:-}
  if [ -z "$val" ]; then echo "skip $key (empty)"; return; fi
  jq -n --arg k "$key" --arg v "$val" '{key:$k,value:$v,type:"encrypted",target:["production","preview"]}' |
    curl -fsS -X POST -H "$AUTH" -H "Content-Type: application/json" "$API/v10/projects/$PID/env?upsert=true&$Q" -d @- > /dev/null
  echo "set $key"
}
for k in DATABASE_URL NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY ANTHROPIC_API_KEY \
         CRON_SECRET AUTH_SECRET DEMO_PASSWORD AI_MODEL_SMART AI_MODEL_FAST; do
  upsert "$k" "${!k:-}"
done

{
  echo "VERCEL_ORG_ID=${TEAM:-$USER_ID}"
  echo "VERCEL_PROJECT_ID=$PID"
  echo "VERCEL_TEAM_QUERY=$Q"
} >> "$GITHUB_ENV"
