#!/bin/bash
# scripts/rollback.sh
# Manual rollback to the previous image version

set -e

echo "=== IST Platform — ROLLBACK ==="

if [ ! -f .rollback ]; then
  echo "ERROR: No .rollback file found. Cannot determine previous image tags."
  echo "Manually set APP_IMAGE and WORKER_IMAGE in .env and restart."
  exit 1
fi

source .rollback
echo "Rolling back to:"
echo "  App:    $PREV_APP"
echo "  Worker: $PREV_WORKER"

sed -i "s|APP_IMAGE=.*|APP_IMAGE=$PREV_APP|" .env
sed -i "s|WORKER_IMAGE=.*|WORKER_IMAGE=$PREV_WORKER|" .env

docker-compose up -d --no-deps app worker

sleep 10
curl -f http://localhost:3000/api/health && echo "✅ Rollback successful" || echo "❌ Rollback failed - check logs"
