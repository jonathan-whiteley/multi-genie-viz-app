# multi-genie-viz-app

A Databricks App that fronts a Multi-Agent Supervisor (MAS) serving endpoint with a chat UI inspired by the AI Genie subtab of `live-data-intelligence`. The MAS supervisor routes each question to one of several Genie spaces; the app shows which Genie is being invoked as a streaming tool-call indicator, persists per-user chat history in Lakebase, and captures thumbs-up/down feedback that propagates to the originating Genie space's monitoring (when MAS surfaces the required IDs).

## Stack

- **Backend:** Express 5 + TypeScript on Node 20
- **Frontend:** React 18 + Vite + Tailwind v4
- **Database:** Lakebase Postgres via Drizzle ORM
- **Streaming:** raw fetch + SSE parsing of Databricks Responses API chunks
- **Deployment:** Databricks Asset Bundles + Databricks Apps with On-Behalf-Of (OBO) auth

## Charting Genie results (portable)

The chart that renders tabular Genie answers is intentionally self-contained
(only `react` + `recharts`) so you can lift it into your own React + FastAPI (or
any) app fronting a multi-Genie MAS endpoint.

- **Component:** [`client/src/components/ResultChart.tsx`](client/src/components/ResultChart.tsx) — takes a single `{ columns, rows }` prop; auto-picks label/value columns, line vs. bar, `$`/`K`/`M` and granularity-aware date ticks.
- **Guide:** [`docs/portable-result-chart.md`](docs/portable-result-chart.md) — the data contract, the MAS → parse → render flow, markdown-table parsing in **TypeScript and Python/FastAPI**, the heuristics, and theming.

## Prerequisites

- A Databricks workspace with the Apps feature enabled
- An existing MAS (Multi-Agent Supervisor) serving endpoint with task type `agent/v1/responses` that routes to one or more Genie spaces. The supervisor must emit `response.output_item.done` chunks with `item.type=function_call` and `item.name` set to the Genie sub-agent identifier.
- A Lakebase Postgres instance in the same workspace
- Databricks CLI authenticated to the workspace (`databricks auth login`)
- Node 20 and `psql` (e.g. `brew install libpq && brew link --force libpq`)

## Quick start

```bash
git clone https://github.com/jonathan-whiteley/multi-genie-viz-app.git
cd multi-genie-viz-app
npm install

# 1. Provision Lakebase (creates instance + database if absent)
./scripts/provision-lakebase.sh

# 2. Fill .env from .env.example with your endpoint + Lakebase creds
cp .env.example .env
# edit .env: MAS_ENDPOINT_NAME, GENIE_SPACES_JSON, LAKEBASE_* (LAKEBASE_PASSWORD is a fresh databricks auth token)

# 3. Migrate the DB schema
npm run -w @multi-genie/db db:migrate

# 4. Run locally (two terminals)
# terminal A — backend
cd server && npx tsx watch src/index.ts
# terminal B — client (Vite proxies /api to :8000)
cd client && npm run dev
# → http://localhost:5173
```

## Environment

| Variable | Purpose |
|---|---|
| `MAS_ENDPOINT_NAME` | Name of the MAS serving endpoint |
| `GENIE_SPACES_JSON` | JSON array of Genie space configs (see below) |
| `LAKEBASE_HOST` / `LAKEBASE_DATABASE` / `LAKEBASE_USER` / `LAKEBASE_PASSWORD` | Lakebase Postgres credentials |
| `GENIE_FEEDBACK_PATH` | Optional. Override the Genie monitoring feedback URL template if your workspace version differs from the default |
| `DEV_EMAIL` | Local-dev only. Bypasses OBO auth and treats every request as this user |
| `DATABRICKS_TOKEN` | Local-dev only. The token used as `accessToken` when not running behind Databricks Apps OBO |

### `GENIE_SPACES_JSON` example

```json
[
  {
    "space_id": "01f0aae3f2a812ceb9f489fa0317532a",
    "label": "LCE Sales TXN",
    "tags": ["sales", "revenue"],
    "tool_name": "lce-sales-txn-genie",
    "suggested_questions": [
      "What were Q1 revenues?",
      "Show top SKUs this month"
    ]
  }
]
```

`tool_name` MUST exactly match the function name the MAS supervisor uses when invoking that Genie sub-agent. The app uses this match to label the routed Genie in the tool-call indicator AND (until MAS surfaces Genie IDs natively) to populate `genieSpaceId` on assistant messages and feedback rows.

## Architecture

```
client (React/Vite, port 5173)
  └── /api/* → server (Express, port 8000) ──┬── Lakebase Postgres (chat history, feedback)
                                              └── Databricks Responses API (MAS endpoint, streaming)
                                                   └── routes internally to Genie spaces
```

The server is a thin orchestrator:
1. Persist user message to Lakebase
2. POST to MAS `/invocations` with `{input: [...], stream: true}`
3. Parse SSE chunks via `parseStreamMeta.classifyChunk` — recognize text-deltas, function_call (tool-call) events, tool-result events, and the leaked `<name>X</name>` artifacts (which are dropped)
4. Re-emit normalized SSE events to the client
5. On stream end, persist the assistant message with extracted metadata

## Feedback propagation

Thumbs-up / thumbs-down on an assistant message:
1. Always persists to the local `app.Feedback` table
2. If the assistant message has all three of `genieSpaceId`, `genieConversationId`, `genieMessageId`, additionally POSTs to:
   ```
   POST /api/2.0/genie/spaces/{space_id}/conversations/{conversation_id}/messages/{message_id}/feedback
   ```
3. If any of the IDs are missing (the common case today — MAS does not surface conversation/message IDs), the local feedback row is created with `syncError = "awaiting MAS upstream update for Genie conversation/message IDs"` and the toast reads "Saved (Genie sync pending MAS update)".

To override the Genie feedback URL template, set `GENIE_FEEDBACK_PATH` with placeholders `{space_id}`, `{conversation_id}`, `{message_id}`.

## Deploy

```bash
# Build the client (server's npm start expects client/dist)
npm run build -w @multi-genie/client

# Sync code + dist into the workspace (skip node_modules and .git)
databricks sync . /Workspace/Users/<you>/multi-genie-viz-app \
  --profile DEFAULT --exclude 'node_modules/**' --exclude '.git/**'

# Deploy the bundle (registers the App resource)
databricks bundle deploy --target prod --profile DEFAULT

# Deploy the App
databricks apps deploy multi-genie-viz-app \
  --source-code-path /Workspace/Users/<you>/multi-genie-viz-app \
  --profile DEFAULT
```

Fill in the App's env-var values (MAS_ENDPOINT_NAME, GENIE_SPACES_JSON, LAKEBASE_*) in the Databricks Apps UI before starting the App.

## License

MIT
