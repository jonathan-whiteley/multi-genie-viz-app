# Portable result chart for Multi-Genie apps

A drop-in React component that turns a tabular Genie answer into a chart. It is
intentionally tiny and dependency-light so you can copy one file into any
React + (Express / **FastAPI** / anything) app that talks to a Databricks
Multi-Agent Supervisor (MAS) endpoint routing to one or more Genie spaces.

- **Component:** [`client/src/components/ResultChart.tsx`](../client/src/components/ResultChart.tsx)
- **Dependencies:** `react` + [`recharts`](https://recharts.org) only. No app CSS, no Tailwind, no design system.
- **It is Genie-agnostic:** it charts whatever table comes back, regardless of which Genie space answered. Adding/removing spaces changes nothing here.

---

## The one thing it needs: a `TableData`

```ts
export type TableData = { columns: string[]; rows: unknown[][] };
```

That's the entire contract between your backend and the chart:

```ts
<ResultChart data={{ columns: ['store', 'predicted_revenue_usd'],
                     rows: [['Boston Downtown', 482000], ['Cambridge', 391500]] }} />
```

Everything else (which column is the label, which is the value, line vs. bar,
`$`/`,`/`K`/`M` formatting, de-underscored titles) is derived automatically.
If the data isn't chartable (fewer than 2 columns or 0 rows) it renders
`null` — safe to mount unconditionally next to your text answer.

---

## End-to-end flow

```
User question
   │
   ▼
MAS serving endpoint  (POST /serving-endpoints/<name>/invocations)
   │   supervisor routes to a Genie space, which returns a result
   │   usually as a markdown pipe-table in the tool-result text
   ▼
Backend                          ◄── you parse the table text here
   markdown table  ──►  TableData  ──► attach to the assistant message
   │
   ▼
Frontend
   <ResultChart data={message.resultData} />   ◄── this repo's component
```

The only backend work is **step "parse the table text" → `TableData`**. The MAS
tool-result for a Genie answer is typically a GitHub-flavored markdown table
like:

```
| store | predicted_revenue_usd |
| --- | --- |
| Boston Downtown | 482000 |
| Cambridge | 391500 |
```

### Backend parse — TypeScript (this repo)

See `tryParseMarkdownTable` in
[`server/src/routes/chat.ts`](../server/src/routes/chat.ts). It validates the
`| --- |` separator row, strips leading/trailing pipes, and splits on `|`.

### Backend parse — Python / FastAPI

Same logic, ready to paste into a FastAPI service:

```python
import re
from typing import Optional, TypedDict

class TableData(TypedDict):
    columns: list[str]
    rows: list[list[str]]

_SEP = re.compile(r"^\|?(\s*[-:]+\s*\|)+\s*[-:]*\s*\|?$")

def try_parse_markdown_table(text: str) -> Optional[TableData]:
    """Best-effort parse of a Genie tool-result as a markdown pipe-table."""
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if len(lines) < 2 or not _SEP.match(lines[1]):
        return None
    def parse_row(line: str) -> list[str]:
        return [c.strip() for c in re.sub(r"^\||\|$", "", line).split("|")]
    return {"columns": parse_row(lines[0]), "rows": [parse_row(l) for l in lines[2:]]}
```

Then attach it to whatever you send the frontend, e.g.:

```python
@app.post("/api/chat")
def chat(req: ChatRequest):
    tool_text = call_mas_and_extract_tool_result(req.message)   # your MAS call
    return {
        "answer": ...,
        "result_data": try_parse_markdown_table(tool_text),     # -> TableData | None
    }
```

#### Getting `tool_text` out of the MAS response

The MAS endpoint uses the Responses API (`task: agent/v1/responses`). Call it
with `{"input": [{"role": "user", "content": "..."}], "stream": false}` and walk
the `output` items: the Genie sub-agent's answer arrives as a tool/function-call
**output** item whose text holds the markdown table. (Names like
`lce-sales-txn-genie` identify which space answered — handy for a "Calling
&lt;space&gt;…" indicator, but not needed for charting.) Forward that text to
`try_parse_markdown_table`. If your endpoint streams (`"stream": true`), buffer
the tool-result chunks and parse once complete.

---

## Drop it into your app

1. `npm install recharts`
2. Copy `ResultChart.tsx` into your components.
3. Parse the Genie table to `TableData` on the backend (above) and render:

```tsx
import { ResultChart } from './ResultChart';

{message.resultData && <ResultChart data={message.resultData} />}
```

That's it. No provider, no context, no config.

---

## How the heuristics work (so you can tweak them)

All logic lives in small pure functions at the top of the file:

| Concern | Function | Rule |
|---|---|---|
| Strip Genie's row-index column | `dropIndexColumns` | drops an empty-header column whose values are `0,1,2,…` |
| Pick the category axis | inline | first column that is *mostly non-numeric* |
| Pick the value axis | inline | last column that is *mostly numeric* |
| Line vs. bar | `isTimeColumn` | label column matching `date\|time\|month\|day\|year\|week` → line; else horizontal bars |
| Date axis ticks | `dateGranularity` + `formatDateTick` | infer day/month/year from the median gap between points; render `Jan 2` / `Jan '23` / `2023`, and thin crowded ticks via `interval="preserveStartEnd"` + `minTickGap` |
| `$` prefix | `isCurrencyColumn` | value column matching `usd\|revenue\|price\|cost\|amount\|…` |
| Axis ticks | `formatTick` | thousands separators + compact `K`/`M`/`B` |
| Tooltip / title | `formatValue`, `humanizeColumn` | full commas + `$`; `gross_revenue_usd` → `Gross Revenue Usd` |

Adjust the regexes to your domain (e.g. add `bookings`, `eur`) or swap the
column-selection rule — each is one self-contained function.

---

## Theming

The component is unstyled except for the series color and a muted title. It
reads CSS variables if your app defines them and otherwise falls back to
sensible defaults, so it looks right with zero setup:

- Series color: `var(--color-chart, #2563eb)` — or pass `accentColor="#16a34a"`.
- Title color: `var(--color-ink-2, #6b7280)`.
- Height: `height={240}` prop (default).

```tsx
<ResultChart data={data} accentColor="#16a34a" height={320} />
```
