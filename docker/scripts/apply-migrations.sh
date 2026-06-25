#!/bin/sh
# One-shot migrator: applies every SQL migration from the repo's
# supabase/migrations folder (mounted at /migrations) against the local database,
# in filename order.
#
# Why a separate service instead of a db-init script:
#   The base schema (01-app-schema.sql) deliberately avoids foreign keys to
#   auth.users because GoTrue (the auth service) creates auth.users only after it
#   starts -- which is AFTER docker-entrypoint-initdb.d runs. Some migrations DO
#   reference auth.users, so they must be applied once auth is up. This service
#   depends on auth being healthy, waits for auth.users to exist, then applies all
#   migrations. Migrations are idempotent (IF NOT EXISTS / DROP ... IF EXISTS), so
#   re-runs and overlap with the base snapshot are harmless. New migrations added
#   to supabase/migrations are picked up automatically -- no snapshot drift.
set -eu

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres-dev-password}"

psql_db() {
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" "$@"
}

echo "[migrator] waiting for auth.users to be created by GoTrue..."
attempts=0
until [ "$(psql_db -tAc "SELECT to_regclass('auth.users') IS NOT NULL;" 2>/dev/null || echo f)" = "t" ]; do
  attempts=$((attempts + 1))
  if [ "$attempts" -gt 60 ]; then
    echo "[migrator] ERROR: timed out waiting for auth.users (120s)"
    exit 1
  fi
  sleep 2
done
echo "[migrator] auth.users present."

found=0
for f in $(ls /migrations/*.sql 2>/dev/null | sort); do
  found=1
  echo "[migrator]   -> $(basename "$f")"
  psql_db -v ON_ERROR_STOP=1 -f "$f"
done

if [ "$found" -eq 0 ]; then
  echo "[migrator] no migrations found in /migrations; nothing to do."
else
  echo "[migrator] all migrations applied."
  # PostgREST caches the schema at startup, which happens before this migrator
  # runs. Tell it to reload so newly created tables (e.g. ai_usage_events) are
  # served by the REST API without a manual restart.
  echo "[migrator] reloading PostgREST schema cache..."
  psql_db -c "NOTIFY pgrst, 'reload schema';" || true
fi
