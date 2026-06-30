#!/usr/bin/env bash
# Build the deploy bundle, upload it to the workspace, and (re)deploy the App.
#
# Usage:
#   REMOTE_PATH=/Workspace/Users/you@example.com/multi-genie-viz-app-deploy npm run deploy
#
# Env vars:
#   REMOTE_PATH  (required) workspace dir to upload the bundle to
#   APP_NAME     (default: multi-genie-viz-app)
#   PROFILE      (default: DEFAULT) Databricks CLI profile
set -euo pipefail
cd "$(dirname "$0")/.."

: "${APP_NAME:=multi-genie-viz-app}"
: "${PROFILE:=DEFAULT}"
: "${REMOTE_PATH:?set REMOTE_PATH=/Workspace/Users/<you>/${APP_NAME}-deploy}"

bash scripts/build-deploy.sh

echo "==> uploading deploy/ -> $REMOTE_PATH"
databricks workspace import-dir deploy "$REMOTE_PATH" --overwrite --profile "$PROFILE"

echo "==> deploying app '$APP_NAME'"
databricks apps deploy "$APP_NAME" --source-code-path "$REMOTE_PATH" --profile "$PROFILE"
