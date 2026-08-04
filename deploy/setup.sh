#!/bin/bash
# HeroKids Universe — first-time server setup
# Run as root on the server: bash setup.sh
set -euo pipefail

REPO="https://github.com/vatharsh/HeroKidsUniverse.git"
BRANCH="main"
APP_DIR="/opt/herokids"
CADDY_CONTAINER="gwx-caddy"
NETWORK="herokids"

echo "▶ Creating app directory..."
mkdir -p "$APP_DIR"
cd "$APP_DIR"

echo "▶ Cloning repo (branch: $BRANCH)..."
if [ -d ".git" ]; then
  git fetch origin && git reset --hard origin/$BRANCH
else
  git clone -b "$BRANCH" "$REPO" .
fi

echo "▶ Checking for .env.production..."
if [ ! -f ".env.production" ]; then
  echo "ERROR: .env.production not found in $APP_DIR"
  echo "Copy deploy/env.production.template → .env.production and fill in the values, then re-run."
  exit 1
fi

echo "▶ Creating Docker network '$NETWORK' (if not exists)..."
docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK"

echo "▶ Connecting Caddy to '$NETWORK' network (no restart)..."
docker network connect "$NETWORK" "$CADDY_CONTAINER" 2>/dev/null || echo "  (already connected)"

echo "▶ Building and starting HeroKids containers..."
DB_PASSWORD=$(grep DB_PASSWORD .env.production | cut -d= -f2)
export DB_PASSWORD
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

echo "▶ Waiting for API to be healthy..."
for i in $(seq 1 30); do
  if docker exec "$(docker compose -f docker-compose.prod.yml ps -q hku-api)" wget -qO- http://localhost:3001/health >/dev/null 2>&1; then
    echo "  API is up."
    break
  fi
  echo "  Waiting... ($i/30)"
  sleep 5
done

echo "▶ Adding HeroKids routes to Caddy..."
CADDYFILE_CONTENT=$(docker exec "$CADDY_CONTAINER" cat /etc/caddy/Caddyfile)

if echo "$CADDYFILE_CONTENT" | grep -q "herokidsuniverse.com"; then
  echo "  Caddy routes already present, skipping."
else
  docker exec "$CADDY_CONTAINER" sh -c "cat >> /etc/caddy/Caddyfile << 'CADDY'

herokidsuniverse.com {
    reverse_proxy hku-web:3000
}

api.herokidsuniverse.com {
    reverse_proxy hku-api:3001
}
CADDY"
  echo "▶ Reloading Caddy config (graceful, no downtime)..."
  docker exec "$CADDY_CONTAINER" caddy reload --config /etc/caddy/Caddyfile
fi

echo ""
echo "✅ Done! HeroKids Universe is live."
echo "   Web:  https://herokidsuniverse.com"
echo "   API:  https://api.herokidsuniverse.com"
echo ""
echo "Next steps:"
echo "  1. Point DNS A records for herokidsuniverse.com and api.herokidsuniverse.com → 23.88.97.92"
echo "  2. Fill in R2 and Razorpay keys in /opt/herokids/.env.production, then run:"
echo "     docker compose -f /opt/herokids/docker-compose.prod.yml up -d hku-api"
