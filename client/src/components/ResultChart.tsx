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

export function ResultChart(props: {
  data: { columns: string[]; rows: unknown[][] };
}) {
  const { columns, rows } = props.data;
  if (columns.length < 2 || rows.length === 0) return null;

  const labelCol = columns[0]!;
  const valueCol = columns[columns.length - 1]!;
  const chartData = rows.map((r) => ({
    [labelCol]: String(r[0]),
    [valueCol]: Number(r[r.length - 1]),
  }));

  const isLine = isTimeColumn(labelCol);
  const title = `${valueCol.toUpperCase()} BY ${labelCol.toUpperCase()}`;

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
            <YAxis />
            <Tooltip />
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
            <XAxis type="number" />
            <YAxis type="category" dataKey={labelCol} width={120} />
            <Tooltip />
            <Bar dataKey={valueCol} fill="var(--color-chart)" radius={[0, 4, 4, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
