import { useEffect, useState } from 'react';
import type { AppConfig, ChatSummary } from '@multi-genie/core';
import { Layout } from './components/Layout.js';
import { Header } from './components/Header.js';
import { HistorySidebar } from './components/HistorySidebar.js';
import { SuggestedQuestions } from './components/SuggestedQuestions.js';
import { ChatPanel } from './components/ChatPanel.js';

export function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [pendingInput, setPendingInput] = useState<string>('');

  useEffect(() => {
    void fetch('/api/config').then((r) => r.json()).then(setConfig);
    void fetch('/api/chats').then((r) => r.json()).then(setChats);
  }, []);

  const newChat = async () => {
    const r = await fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const c: ChatSummary = await r.json();
    setChats((cs) => [c, ...cs]);
    setActiveChatId(c.id);
    return c.id;
  };

  const sendFromHome = async (text: string) => {
    await newChat();
    setPendingInput(text);
  };

  return (
    <Layout
      header={<Header />}
      sidebar={
        <HistorySidebar
          chats={chats}
          activeChatId={activeChatId}
          onSelect={setActiveChatId}
          onNew={() => {
            setActiveChatId(null);
          }}
        />
      }
      main={
        <ChatPanel
          chatId={activeChatId}
          spaces={config?.spaces ?? []}
          pendingInput={pendingInput}
          onConsumePending={() => setPendingInput('')}
          onSendFromHome={sendFromHome}
        />
      }
      rightPanel={
        <SuggestedQuestions
          spaces={config?.spaces ?? []}
          onPick={async (q) => {
            if (!activeChatId) {
              await sendFromHome(q);
            } else {
              setPendingInput(q);
            }
          }}
        />
      }
    />
  );
}
