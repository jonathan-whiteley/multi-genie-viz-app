import clsx from 'clsx';

export function MetricChip(props: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={clsx(
        'inline-flex flex-col rounded-lg px-3 py-2 text-left',
        props.highlight
          ? 'bg-[color:var(--color-chip-hl-bg)] text-[color:var(--color-chip-hl-ink)]'
          : 'bg-[color:var(--color-chip-bg)] text-[color:var(--color-ink)]',
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
        {props.label}
      </span>
      <span className="text-base font-semibold">{props.value}</span>
    </div>
  );
}
