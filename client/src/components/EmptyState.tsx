import logo from '../assets/logo.svg';

export function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-[color:var(--color-card-border)] bg-[color:var(--color-card)] px-8 py-12 text-center">
      <img src={logo} alt="" className="h-16 w-16" />
      <h2 className="mt-6 text-2xl font-semibold">Ask Genie</h2>
      <p className="mt-1 text-sm text-[color:var(--color-ink-2)]">
        Click a suggested question or type your own below
      </p>
    </div>
  );
}
