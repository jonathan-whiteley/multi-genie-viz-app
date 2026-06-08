import type { SpaceConfig } from '@multi-genie/core';

export function ChatPanel(_props: {
  chatId: string;
  spaces: SpaceConfig[];
  pendingInput: string;
  onConsumePending: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-[color:var(--color-card-border)] bg-[color:var(--color-card)] p-6 text-sm text-[color:var(--color-ink-2)]">
      ChatPanel placeholder — full streaming UI lands in Task 19
    </div>
  );
}
