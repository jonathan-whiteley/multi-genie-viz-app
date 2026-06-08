export function ThinkingDots() {
  return (
    <div className="inline-flex items-center gap-2 text-xs text-[color:var(--color-ink-2)]">
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--color-ink-2)]" />
      <span>Genie is thinking…</span>
    </div>
  );
}
