#!/bin/bash
# HeroKids Universe — redeploy after code changes
# Run as root on server: bash /opt/herokids/deploy/redeploy.sh
set -euo pipefail

APP_DIR="/opt/herokids"
cd "$APP_DIR"

echo "▶ Pulling latest code..."
git pull origin main

echo "▶ Rebuilding and restarting containers..."
DB_PASSWORD=$(grep DB_PASSWORD .env.production | cut -d= -f2)
export DB_PASSWORD
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build hku-api hku-web

echo "✅ Redeployed."
