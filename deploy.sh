#!/usr/bin/env bash
# Deploy meta-graph-proxy to Vercel from Contabo (or any machine with npm).
#
# 1. Create token: https://vercel.com/account/tokens
# 2. export VERCEL_TOKEN=your_token
# 3. ./deploy.sh
set -euo pipefail

cd "$(dirname "$0")"
SECRET_FILE="../.env"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "ERROR: Set VERCEL_TOKEN first."
  echo "  Create at: https://vercel.com/account/tokens"
  echo "  export VERCEL_TOKEN=..."
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "Installing npm (nodejs)..."
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs npm
fi

PROXY_SECRET=""
if [[ -f "$SECRET_FILE" ]]; then
  PROXY_SECRET=$(grep '^META_GRAPH_PROXY_SECRET=' "$SECRET_FILE" | tail -1 | cut -d= -f2-)
fi
if [[ -z "$PROXY_SECRET" ]]; then
  PROXY_SECRET=$(openssl rand -hex 24)
  echo "META_GRAPH_PROXY_SECRET=$PROXY_SECRET" >> "$SECRET_FILE"
  echo "Added META_GRAPH_PROXY_SECRET to ~/app/.env"
fi

echo "Deploying to Vercel..."
npx --yes vercel@latest link --yes --token "$VERCEL_TOKEN" 2>/dev/null || \
  npx --yes vercel@latest link --yes --token "$VERCEL_TOKEN"

echo "$PROXY_SECRET" | npx --yes vercel@latest env rm META_PROXY_SECRET production --yes --token "$VERCEL_TOKEN" 2>/dev/null || true
echo "$PROXY_SECRET" | npx --yes vercel@latest env add META_PROXY_SECRET production --token "$VERCEL_TOKEN"

npx --yes vercel@latest --prod --yes --token "$VERCEL_TOKEN"

echo ""
echo "=== Done ==="
echo "1. Vercel dashboard → add domain: graph-proxy.ordertaptap.com"
echo "2. Cloudflare DNS: CNAME graph-proxy → cname.vercel-dns.com"
echo "3. Contabo: cd ~/app && docker compose up -d --force-recreate api"
echo ""
echo "Test:"
echo "  curl -sS -o /dev/null -w '%{http_code}\n' -H 'X-Meta-Proxy-Secret: $PROXY_SECRET' https://graph-proxy.ordertaptap.com/v25.0/"
