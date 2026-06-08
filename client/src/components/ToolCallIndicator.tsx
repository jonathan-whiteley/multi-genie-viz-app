import { Sparkles, Loader2 } from 'lucide-react';

export function ToolCallIndicator(props: { label: string; complete?: boolean }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-chip-bg)] px-3 py-1 text-xs">
      {props.complete ? (
        <Sparkles size={12} className="text-[color:var(--color-accent)]" />
      ) : (
        <Loader2 size={12} className="animate-spin text-[color:var(--color-accent)]" />
      )}
      {props.complete ? (
        <span>{props.label}</span>
      ) : (
        <span>
          Calling <strong>{props.label}</strong>…
        </span>
      )}
    </div>
  );
}
