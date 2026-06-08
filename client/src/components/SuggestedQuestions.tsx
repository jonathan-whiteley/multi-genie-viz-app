import type { SpaceConfig } from '@multi-genie/core';

export function SuggestedQuestions(props: {
  spaces: SpaceConfig[];
  onPick: (q: string) => void;
}) {
  const all = props.spaces.flatMap((s) =>
    s.suggested_questions.map((q) => ({ q, space: s })),
  );
  return (
    <div className="flex h-full flex-col rounded-2xl border border-[color:var(--color-card-border)] bg-[color:var(--color-card)] p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-ink-2)]">
        Suggested Questions
      </div>
      <div className="mt-3 space-y-2 overflow-y-auto">
        {all.map(({ q, space }, i) => (
          <button
            key={i}
            type="button"
            onClick={() => props.onPick(q)}
            className="w-full rounded-xl border border-[color:var(--color-card-border)] px-3 py-2 text-left text-sm hover:bg-[color:var(--color-chip-bg)]"
          >
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[color:var(--color-accent)]" />
            {q}
            <div className="mt-1 text-[11px] text-[color:var(--color-ink-2)]">{space.label}</div>
          </button>
        ))}
        {all.length === 0 && (
          <div className="px-3 py-2 text-xs text-[color:var(--color-ink-2)]">
            No suggestions configured
          </div>
        )}
      </div>
    </div>
  );
}
