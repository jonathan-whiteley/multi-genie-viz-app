import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Line,
  LineChart,
} from 'recharts';

/**
 * The only data shape this component needs. Produce it however you like
 * (a markdown-table parser, a Genie SQL result, a JSON API, etc.) — see
 * docs/portable-result-chart.md for the end-to-end approach.
 */
export type TableData = { columns: string[]; rows: unknown[][] };

// ---------------------------------------------------------------------------
// Pure formatting helpers (no React, no app dependencies). Copy as-is.
// ---------------------------------------------------------------------------

const isTimeColumn = (name: string) => /date|time|month|day|year|week/i.test(name);

// Heuristic: does this column hold a USD amount? Drives the "$" prefix.
const isCurrencyColumn = (name: string) =>
  /usd|revenue|sales|price|cost|amount|spend|dollar|arr|mrr|gmv|payment|fee|charge|balance|income|profit|margin|gross|net/i.test(
    name,
  );

const isNumeric = (v: unknown) => v !== null && v !== undefined && Number.isFinite(Number(v));

// "gross_revenue_usd" -> "Gross Revenue Usd". De-underscores and Title-Cases.
const humanizeColumn = (name: string) =>
  name
    .replace(/[_\s]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

// Full value with thousands separators (and "$" for currency). Used in tooltips.
const formatValue = (v: number, currency: boolean) => {
  if (!Number.isFinite(v)) return '';
  const s = v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return currency ? `$${s}` : s;
};

// Compact value for axis ticks: 1234567 -> "1.2M" (or "$1.2M" for currency).
const formatTick = (v: number, currency: boolean) => {
  if (!Number.isFinite(v)) return '';
  const abs = Math.abs(v);
  let s: string;
  if (abs >= 1_000_000_000) s = `${(v / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  else if (abs >= 1_000_000) s = `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  else if (abs >= 1_000) s = `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  else s = v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return currency ? `$${s}` : s;
};

// Drop columns that look like row-index junk: empty header AND every value is a
// sequential integer (Genie tool-results include a "" header column of row indices).
const dropIndexColumns = ({ columns, rows }: TableData): TableData => {
  const keep = columns
    .map((_c, i) => i)
    .filter((i) => {
      const header = columns[i]?.trim() ?? '';
      if (header !== '') return true;
      const looksLikeIndex = rows.every((r, ri) => r[i] === ri || String(r[i]) === String(ri));
      return !looksLikeIndex;
    });
  return { columns: keep.map((i) => columns[i]!), rows: rows.map((r) => keep.map((i) => r[i])) };
};

// ---------------------------------------------------------------------------
// Component. Self-contained: needs only React + recharts. Theming reads CSS
// variables when present and falls back to hard-coded colors when dropped into
// an app that doesn't define them, so it works anywhere with zero setup.
// ---------------------------------------------------------------------------

export function ResultChart(props: {
  data: TableData;
  /** Series color. Defaults to the host app's --color-chart, else a blue. */
  accentColor?: string;
  height?: number;
}) {
  const accent = props.accentColor ?? 'var(--color-chart, #2563eb)';
  const height = props.height ?? 240;

  const { columns, rows } = dropIndexColumns(props.data);
  if (columns.length < 2 || rows.length === 0) return null;

  // Label = first mostly-text column; value = last mostly-numeric column.
  const numericCount = (i: number) => rows.filter((r) => isNumeric(r[i])).length;
  const firstTextCol = columns.findIndex((_c, i) => numericCount(i) < rows.length / 2);
  const labelIdx = firstTextCol >= 0 ? firstTextCol : 0;
  let valueIdx = columns.length - 1;
  for (let i = columns.length - 1; i >= 0; i--) {
    if (i !== labelIdx && numericCount(i) > rows.length / 2) {
      valueIdx = i;
      break;
    }
  }

  const labelCol = columns[labelIdx]!;
  const valueCol = columns[valueIdx]!;
  const chartData = rows.map((r) => ({
    [labelCol]: String(r[labelIdx] ?? ''),
    [valueCol]: Number(r[valueIdx]),
  }));

  // Time-series label -> line chart; categorical label -> horizontal bars.
  const isLine = isTimeColumn(labelCol);
  const currency = isCurrencyColumn(valueCol);
  const valueLabel = humanizeColumn(valueCol);
  const tickFmt = (v: number) => formatTick(v, currency);
  const tooltipFmt = (v: number): [string, string] => [formatValue(Number(v), currency), valueLabel];

  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          marginBottom: 8,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-2, #6b7280)',
        }}
      >
        {valueLabel} by {humanizeColumn(labelCol)}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        {isLine ? (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey={labelCol} />
            <YAxis tickFormatter={tickFmt} width={72} />
            <Tooltip formatter={tooltipFmt} />
            <Line type="monotone" dataKey={valueCol} stroke={accent} strokeWidth={2} dot={false} />
          </LineChart>
        ) : (
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis type="number" tickFormatter={tickFmt} />
            <YAxis type="category" dataKey={labelCol} width={120} />
            <Tooltip formatter={tooltipFmt} />
            <Bar dataKey={valueCol} fill={accent} radius={[0, 4, 4, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
