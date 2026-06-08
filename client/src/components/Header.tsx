import logo from '../assets/logo.svg';

export function Header() {
  return (
    <div className="flex items-center gap-3">
      <img src={logo} alt="" className="h-8 w-8" />
      <div>
        <div className="text-xl font-semibold">Ask Genie</div>
        <div className="text-xs text-[color:var(--color-ink-2)]">Multi-space chat</div>
      </div>
    </div>
  );
}
