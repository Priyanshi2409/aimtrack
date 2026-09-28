#!/usr/bin/env bash
# Finds the stable production domain (*.vercel.app or a custom domain) for the project.
set -euo pipefail
API=https://api.vercel.com
AUTH="Authorization: Bearer $VERCEL_TOKEN"
DOMAINS=$(curl -fsS -H "$AUTH" "$API/v9/projects/$VERCEL_PROJECT_ID/domains?$VERCEL_TEAM_QUERY")
DOMAIN=$(echo "$DOMAINS" | jq -r '[.domains[] | select(.redirect == null) | .name] | sort_by(length) | .[0] // empty')
if [ -z "$DOMAIN" ]; then DOMAIN=$(sed 's#https://##' deploy-url.txt | tail -1); fi
echo "PROD_URL=https://$DOMAIN" >> "$GITHUB_ENV"
echo "Production URL: https://$DOMAIN"
