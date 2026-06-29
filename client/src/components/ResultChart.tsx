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

function isTimeColumn(name: string) {
  return /date|time|month|day|year|week/i.test(name);
}

// Heuristic: does this column hold a USD amount? Drives the "$" prefix on ticks/tooltips.
function isCurrencyColumn(name: string) {
  return /usd|revenue|sales|price|cost|amount|spend|dollar|arr|mrr|gmv|payment|fee|charge|balance|income|profit|margin|gross|net/i.test(
    name,
  );
}

// "gross_revenue_usd" -> "Gross Revenue Usd". De-underscores and Title-Cases column names.
function humanizeColumn(name: string) {
  return name
    .replace(/[_\s]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Full value with thousands separators (and "$" for currency). Used in tooltips.
function formatValue(v: number, currency: boolean) {
  if (!Number.isFinite(v)) return '';
  const s = v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return currency ? `$${s}` : s;
}

// Compact value for axis ticks: 1234567 -> "1.2M" (or "$1.2M" for currency).
function formatTick(v: number, currency: boolean) {
  if (!Number.isFinite(v)) return '';
  const abs = Math.abs(v);
  let s: string;
  if (abs >= 1_000_000_000) s = `${(v / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  else if (abs >= 1_000_000) s = `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  else if (abs >= 1_000) s = `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  else s = v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return currency ? `$${s}` : s;
}

function isNumeric(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  const n = Number(v);
  return Number.isFinite(n);
}

// Drop columns that look like row-index junk: empty header AND every value is a
// sequential integer (Genie's tool-results include a "" header column with row indices).
function dropIndexColumns(columns: string[], rows: unknown[][]) {
  const keep: number[] = [];
  for (let i = 0; i < columns.length; i++) {
    const header = columns[i]?.trim() ?? '';
    if (header === '') {
      const looksLikeIndex = rows.every((r, ri) => {
        const v = r[i];
        return v === ri || String(v) === String(ri);
      });
      if (looksLikeIndex) continue;
    }
    keep.push(i);
  }
  return {
    columns: keep.map((i) => columns[i]!),
    rows: rows.map((r) => keep.map((i) => r[i])),
  };
}

export function ResultChart(props: {
  data: { columns: string[]; rows: unknown[][] };
}) {
  const cleaned = dropIndexColumns(props.data.columns, props.data.rows);
  const { columns, rows } = cleaned;
  if (columns.length < 2 || rows.length === 0) return null;

  // Pick the first column whose values are mostly non-numeric strings as the label;
  // pick the last numeric column as the value.
  const numericCount = (i: number) => rows.filter((r) => isNumeric(r[i])).length;
  const labelIdx =
    columns.findIndex((_c, i) => numericCount(i) < rows.length / 2) >= 0
      ? columns.findIndex((_c, i) => numericCount(i) < rows.length / 2)
      : 0;
  const valueIdx = (() => {
    for (let i = columns.length - 1; i >= 0; i--) {
      if (i !== labelIdx && numericCount(i) > rows.length / 2) return i;
    }
    return columns.length - 1;
  })();

  const labelCol = columns[labelIdx]!;
  const valueCol = columns[valueIdx]!;
  const chartData = rows.map((r) => ({
    [labelCol]: String(r[labelIdx] ?? ''),
    [valueCol]: Number(r[valueIdx]),
  }));

  const isLine = isTimeColumn(labelCol);
  const valueIsCurrency = isCurrencyColumn(valueCol);
  const valueLabel = humanizeColumn(valueCol);
  const title = `${valueLabel} by ${humanizeColumn(labelCol)}`;
  const tickFmt = (v: number) => formatTick(v, valueIsCurrency);
  const tooltipFmt = (v: number): [string, string] => [
    formatValue(Number(v), valueIsCurrency),
    valueLabel,
  ];

  return (
    <div className="mt-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-2)]">
        {title}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        {isLine ? (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey={labelCol} />
            <YAxis tickFormatter={tickFmt} width={72} />
            <Tooltip formatter={tooltipFmt} />
            <Line
              type="monotone"
              dataKey={valueCol}
              stroke="var(--color-chart)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        ) : (
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis type="number" tickFormatter={tickFmt} />
            <YAxis type="category" dataKey={labelCol} width={120} />
            <Tooltip formatter={tooltipFmt} />
            <Bar dataKey={valueCol} fill="var(--color-chart)" radius={[0, 4, 4, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
