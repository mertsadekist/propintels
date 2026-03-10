#!/bin/bash
# scripts/migrate-prod.sh
# Run before deploying a new app version to production

set -e

echo "=== IST Platform — Production Migration Script ==="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# 1. Verify DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

# 2. Check current migration status
echo "Current migration status:"
npx prisma migrate status

# 3. Run pending migrations
echo "Running migrations..."
npx prisma migrate deploy

if [ $? -eq 0 ]; then
  echo "✅ Migrations completed successfully"
else
  echo "❌ Migration failed! Check errors above."
  exit 1
fi

# 4. Verify DB connectivity after migration
echo "Verifying database connection..."
npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null

echo "=== Migration complete ==="
