#!/usr/bin/env bash
# provision-lakebase.sh
#
# NOTE: The workspace quota is currently at its limit (10 instances).
# This script will reuse the existing shared dev instance "jdub-lakebase-db-instance"
# if the named instance cannot be created. To use a dedicated instance, free quota first.
#
# Usage:
#   ./scripts/provision-lakebase.sh
#   DATABRICKS_PROFILE=vm ./scripts/provision-lakebase.sh
set -euo pipefail

INSTANCE="multi-genie-viz-app"
FALLBACK_INSTANCE="jdub-lakebase-db-instance"
DB="multi_genie_app"
PROFILE="${DATABRICKS_PROFILE:-DEFAULT}"

# Try to get or create the named instance
if databricks database get-database-instance "$INSTANCE" --profile "$PROFILE" --output json >/dev/null 2>&1; then
  echo "Instance $INSTANCE already exists."
else
  echo "Attempting to create instance $INSTANCE..."
  CREATE_OUT=$(databricks database create-database-instance --profile "$PROFILE" \
    --json "{\"name\":\"$INSTANCE\",\"capacity\":\"CU_1\"}" 2>&1) || true

  if echo "$CREATE_OUT" | grep -qi "quota\|limit"; then
    echo "Quota limit reached — falling back to shared instance: $FALLBACK_INSTANCE"
    INSTANCE="$FALLBACK_INSTANCE"
  else
    echo "$CREATE_OUT"
  fi
fi

echo "Waiting for AVAILABLE..."
STATE=""
for i in {1..60}; do
  STATE=$(databricks database get-database-instance "$INSTANCE" --profile "$PROFILE" --output json | jq -r '.state')
  echo "  Iteration $i: state=$STATE"
  if [ "$STATE" = "AVAILABLE" ]; then break; fi
  sleep 10
done

if [ "$STATE" != "AVAILABLE" ]; then
  echo "Instance did not reach AVAILABLE in 10 minutes" >&2
  exit 1
fi

PG_HOST=$(databricks database get-database-instance "$INSTANCE" --profile "$PROFILE" --output json | jq -r '.read_write_dns')
DB_USER=$(databricks current-user me --profile "$PROFILE" --output json | jq -r '.userName')
PG_PASSWORD=$(databricks auth token --profile "$PROFILE" --output json | jq -r '.access_token')

EXISTS=$(PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -U "$DB_USER" -d databricks_postgres -At \
  -c "SELECT 1 FROM pg_database WHERE datname='$DB';" 2>/dev/null || echo "")
if [ "$EXISTS" = "1" ]; then
  echo "Database $DB already exists."
else
  echo "Creating database $DB..."
  PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -U "$DB_USER" -d databricks_postgres \
    -c "CREATE DATABASE $DB;"
fi

echo ""
echo "Lakebase ready!"
echo "  Instance:  $INSTANCE"
echo "  Host:      $PG_HOST"
echo "  Database:  $DB"
echo "  User:      $DB_USER"
echo ""
echo "Add to .env:"
echo "  LAKEBASE_INSTANCE=$INSTANCE"
echo "  LAKEBASE_HOST=$PG_HOST"
echo "  LAKEBASE_DATABASE=$DB"
echo "  LAKEBASE_USER=$DB_USER"
echo "  LAKEBASE_PASSWORD=<run 'databricks auth token --profile $PROFILE | jq -r .access_token' to get a fresh one>"
