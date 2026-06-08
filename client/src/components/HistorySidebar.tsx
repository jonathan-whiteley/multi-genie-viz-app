import type { ChatSummary } from '@multi-genie/core';
import clsx from 'clsx';

export function HistorySidebar(props: {
  chats: ChatSummary[];
  activeChatId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-[color:var(--color-card-border)] bg-[color:var(--color-card)] p-3">
      <button
        type="button"
        onClick={props.onNew}
        className="w-full rounded-xl border border-[color:var(--color-card-border)] py-2 text-sm font-medium hover:bg-[color:var(--color-chip-bg)]"
      >
        + New Chat
      </button>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        <div className="px-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-ink-2)]">
          History
        </div>
        <ul className="mt-2 space-y-1">
          {props.chats.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => props.onSelect(c.id)}
                className={clsx(
                  'w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[color:var(--color-chip-bg)]',
                  props.activeChatId === c.id &&
                    'border-l-2 border-[color:var(--color-accent)] bg-[color:var(--color-chip-bg)]',
                )}
              >
                <div className="truncate font-medium">{c.title ?? 'Untitled'}</div>
                <div className="text-[11px] text-[color:var(--color-ink-2)]">
                  {new Date(c.updatedAt).toLocaleDateString()}
                </div>
              </button>
            </li>
          ))}
          {props.chats.length === 0 && (
            <li className="px-3 py-2 text-xs text-[color:var(--color-ink-2)]">No chats yet</li>
          )}
        </ul>
      </div>
    </div>
  );
}
