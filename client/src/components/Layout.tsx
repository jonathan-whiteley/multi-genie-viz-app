import type { ReactNode } from 'react';

export function Layout(props: {
  sidebar: ReactNode;
  main: ReactNode;
  rightPanel: ReactNode;
  header: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-4">{props.header}</div>
      <div
        className="mx-auto grid w-full max-w-[1600px] flex-1 gap-4 px-6 pb-6"
        style={{ gridTemplateColumns: '240px 1fr 280px' }}
      >
        <aside className="min-h-0">{props.sidebar}</aside>
        <main className="min-h-0">{props.main}</main>
        <aside className="min-h-0">{props.rightPanel}</aside>
      </div>
    </div>
  );
}
