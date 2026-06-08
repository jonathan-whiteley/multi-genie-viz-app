import { useState } from 'react';
import { Code2, ChevronDown } from 'lucide-react';

export function ShowSqlDisclosure(props: { sql: string; rowCount?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 rounded-xl border border-[color:var(--color-card-border)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-xl bg-[color:var(--color-chip-bg)] px-3 py-2 text-left text-sm"
      >
        <span className="flex items-center gap-2">
          <Code2 size={14} />
          Show SQL
        </span>
        <span className="flex items-center gap-2 text-xs text-[color:var(--color-ink-2)]">
          {props.rowCount !== undefined && <span>{props.rowCount} rows</span>}
          <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
        </span>
      </button>
      {open && (
        <pre className="overflow-x-auto p-3 text-xs leading-relaxed text-[color:var(--color-ink-2)]">
          <code>{props.sql}</code>
        </pre>
      )}
    </div>
  );
}
