import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles } from 'lucide-react';
import { ToolCallIndicator } from './ToolCallIndicator.js';
import { ShowSqlDisclosure } from './ShowSqlDisclosure.js';
import { ResultChart } from './ResultChart.js';
import { MetricChip } from './MetricChip.js';
import { FeedbackButtons } from './FeedbackButtons.js';

export function AssistantMessage(props: {
  messageId?: string;
  text: string;
  toolLabel: string | null;
  sql: string | null;
  rows: { columns: string[]; rows: unknown[][] } | null;
  metrics?: { label: string; value: string; highlight?: boolean }[];
  showFeedback?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--color-card-border)] bg-[color:var(--color-card)] p-4">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-[color:var(--color-accent)]" />
        {props.toolLabel && <ToolCallIndicator label={props.toolLabel} complete />}
      </div>
      <div className="mt-2 text-sm leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{props.text}</ReactMarkdown>
      </div>
      {props.metrics && props.metrics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {props.metrics.map((m, i) => (
            <MetricChip key={i} {...m} />
          ))}
        </div>
      )}
      {props.sql && <ShowSqlDisclosure sql={props.sql} rowCount={props.rows?.rows.length} />}
      {props.rows && <ResultChart data={props.rows} />}
      {props.showFeedback && props.messageId && (
        <FeedbackButtons messageId={props.messageId} spaceLabel={props.toolLabel} />
      )}
    </div>
  );
}
