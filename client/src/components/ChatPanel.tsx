import { useEffect, useRef, useState } from 'react';
import type { SpaceConfig } from '@multi-genie/core';
import { useStreamingChat } from '../hooks/useStreamingChat.js';
import { Message } from './Message.js';
import { AssistantMessage } from './AssistantMessage.js';
import { ThinkingDots } from './ThinkingDots.js';
import { ToolCallIndicator } from './ToolCallIndicator.js';
import { Send } from 'lucide-react';

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
  chatId: string;
  spaces: SpaceConfig[];
  pendingInput: string;
  onConsumePending: () => void;
}) {
  const { messages, live, state, send } = useStreamingChat(props.chatId);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (props.pendingInput) {
      const q = props.pendingInput;
      props.onConsumePending();
      void send(q);
    }
  }, [props.pendingInput, props.onConsumePending, send]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, live, state]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[color:var(--color-card-border)] bg-[color:var(--color-card)]">
      <div className="border-b border-[color:var(--color-card-border)] px-4 py-3 text-sm font-semibold">
        ✨ Ask Genie
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <Message
            key={m.id}
            message={m}
            spaceLabel={resolveLabel(props.spaces, m.genieSpaceId, m.toolName)}
          />
        ))}
        {state.phase === 'thinking' && (
          <div className="rounded-2xl border border-[color:var(--color-card-border)] bg-[color:var(--color-card)] p-4">
            <ThinkingDots />
          </div>
        )}
        {state.phase === 'tool-call' && (
          <div className="rounded-2xl border border-[color:var(--color-card-border)] bg-[color:var(--color-card)] p-4">
            <ToolCallIndicator label={state.label} />
          </div>
        )}
        {state.phase === 'streaming' && live && (
          <AssistantMessage text={live.text} toolLabel={live.toolLabel} sql={null} rows={null} />
        )}
        <div ref={endRef} />
      </div>
      <form
        className="flex items-center gap-2 border-t border-[color:var(--color-card-border)] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const t = input.trim();
          if (!t) return;
          setInput('');
          void send(t);
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about your data…"
          className="flex-1 rounded-xl border border-[color:var(--color-card-border)] px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-95"
        >
          <Send size={14} /> Ask
        </button>
      </form>
    </div>
  );
}
