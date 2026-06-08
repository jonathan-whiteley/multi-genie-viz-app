import logo from './assets/logo.svg';

export function App() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <img src={logo} alt="" className="mx-auto h-16 w-16" />
        <h1 className="mt-4 text-2xl font-semibold">Ask Genie</h1>
        <p className="mt-1 text-sm text-[color:var(--color-ink-2)]">scaffold ready</p>
      </div>
    </div>
  );
}
