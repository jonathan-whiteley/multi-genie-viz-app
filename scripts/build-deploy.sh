#!/usr/bin/env bash
# Assemble a Databricks Apps deploy bundle in ./deploy.
#
# Databricks Apps runs `npm install` against the uploaded package.json and then
# `npm run start`. It does NOT compile TypeScript and does NOT resolve npm
# workspaces, so a plain `tsc` build crashes at runtime with
#   ERR_MODULE_NOT_FOUND: Cannot find package '@multi-genie/auth'
# To make a self-contained artifact we:
#   1. build the client (vite)               -> client/dist
#   2. bundle the server with esbuild into ONE file that inlines the
#      @multi-genie/* workspace packages, keeping only the runtime npm deps
#      external                              -> deploy/server/dist/index.js
#   3. ship the minimal deploy-package.json (as package.json) listing exactly
#      those runtime deps, so the platform install is tiny and never times out.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=deploy
rm -rf "$OUT"
mkdir -p "$OUT/server/dist" "$OUT/client"

echo "==> building client (vite)"
npm run build -w @multi-genie/client

echo "==> bundling server (esbuild)"
# Externalize exactly the deps declared in deploy-package.json so the bundle's
# externals and the installed runtime deps can never drift apart.
EXTERNALS=$(node -e "const d=require('./deploy-package.json').dependencies||{};console.log(Object.keys(d).flatMap(p=>['--external:'+p,'--external:'+p+'/*']).join(' '))")
# shellcheck disable=SC2086
npx esbuild server/src/index.ts --bundle --platform=node --format=esm --target=node20 \
  $EXTERNALS --outfile="$OUT/server/dist/index.js"

echo "==> assembling $OUT/"
cp -R client/dist "$OUT/client/dist"
cp deploy-package.json "$OUT/package.json"
cp app.yaml "$OUT/"
[ -f .npmrc ] && cp .npmrc "$OUT/"

echo "==> built $OUT/  (upload + deploy with: npm run deploy)"
