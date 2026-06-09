import { useEffect, useRef, useState } from 'react';
import type { SpaceConfig } from '@multi-genie/core';
import { useStreamingChat } from '../hooks/useStreamingChat.js';
import { Message } from './Message.js';
import { AssistantMessage } from './AssistantMessage.js';
import { ThinkingDots } from './ThinkingDots.js';
import { ToolCallIndicator } from './ToolCallIndicator.js';
import { Send, Sparkles } from 'lucide-react';
import logo from '../assets/logo.svg';

function resolveLabel(
  spaces: SpaceConfig[],
  spaceId: string | null,
  toolName: string | null,
): string | null {
  if (spaceId) {
    const s = spaces.find((x) => x.space_id === spaceId);
    if (s) return s.label;
  }
  if (toolName) {
    const s = spaces.find((x) => x.tool_name === toolName);
    if (s) return s.label;
  }
  return null;
}

export function ChatPanel(props: {
  chatId: string | null;
  spaces: SpaceConfig[];
  pendingInput: string;
  onConsumePending: () => void;
  onSendFromHome: (text: string) => Promise<void>;
}) {
  const { messages, live, state, send } = useStreamingChat(props.chatId ?? '');
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (props.pendingInput && props.chatId) {
      const q = props.pendingInput;
      props.onConsumePending();
      void send(q);
    }
  }, [props.pendingInput, props.chatId, props.onConsumePending, send]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, live, state]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = input.trim();
    if (!t) return;
    setInput('');
    if (!props.chatId) {
      await props.onSendFromHome(t);
    } else {
      void send(t);
    }
  };

  const isHome = !props.chatId;
  const isLoading =
    state.phase === 'thinking' ||
    state.phase === 'tool-call' ||
    state.phase === 'streaming';

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[color:var(--color-card-border)] bg-[color:var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[color:var(--color-card-border)] px-4 py-3 text-sm font-semibold">
        <span className="inline-flex items-center gap-2">
          <Sparkles size={14} className="text-[color:var(--color-accent)]" /> Ask Genie
        </span>
        {state.phase === 'thinking' && <ThinkingDots />}
        {state.phase === 'tool-call' && <ToolCallIndicator label={state.label} />}
        {state.phase === 'streaming' && live?.toolLabel && (
          <ToolCallIndicator label={live.toolLabel} complete />
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {isHome && messages.length === 0 && !isLoading && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <img src={logo} alt="" className="h-16 w-16" />
            <h2 className="mt-6 text-2xl font-semibold">Ask Genie</h2>
            <p className="mt-1 text-sm text-[color:var(--color-ink-2)]">
              Click a suggested question or type your own below
            </p>
          </div>
        )}
        {messages.map((m) => (
          <Message
            key={m.id}
            message={m}
            spaceLabel={resolveLabel(props.spaces, m.genieSpaceId, m.toolName)}
          />
        ))}
        {state.phase === 'thinking' && (
          <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--color-card-border)] bg-[color:var(--color-card)] p-4">
            <Sparkles size={14} className="animate-pulse text-[color:var(--color-accent)]" />
            <ThinkingDots />
          </div>
        )}
        {state.phase === 'tool-call' && (
          <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--color-card-border)] bg-[color:var(--color-card)] p-4">
            <ToolCallIndicator label={state.label} />
          </div>
        )}
        {state.phase === 'streaming' && live && (
          <AssistantMessage
            text={live.text}
            toolLabel={live.toolLabel}
            sql={null}
            rows={null}
          />
        )}
        <div ref={endRef} />
      </div>
      <form
        className="flex items-center gap-2 border-t border-[color:var(--color-card-border)] p-3"
        onSubmit={onSubmit}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about your data…"
          disabled={isLoading}
          className="flex-1 rounded-xl border border-[color:var(--color-card-border)] px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-95 disabled:opacity-50"
        >
          <Send size={14} /> Ask
        </button>
      </form>
    </div>
  );
}
