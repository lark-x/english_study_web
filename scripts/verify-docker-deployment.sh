#!/usr/bin/env bash
set -euo pipefail

echo "== Compose status =="
docker compose ps

echo "== API health through Nginx =="
curl --fail --silent --show-error http://127.0.0.1:4173/health
echo

echo "== API container health =="
api_health="$(docker inspect --format '{{.State.Health.Status}}' english-study-api 2>/dev/null || true)"
test "$api_health" = "healthy"
echo "$api_health"

echo "== PostgreSQL network =="
docker inspect --format '{{json .NetworkSettings.Networks}}' english-study-api | grep -q 'nekro_network'
docker inspect --format '{{json .NetworkSettings.Networks}}' nekro_postgres | grep -q 'nekro_network'
echo "nekro_network connected"

echo "Deployment verification passed."
