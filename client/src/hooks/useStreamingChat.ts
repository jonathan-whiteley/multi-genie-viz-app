import { useCallback, useEffect, useRef, useState } from 'react';
import type { StoredMessage, GenieMeta } from '@multi-genie/core';
import { fetchMessages } from '../lib/api.js';

type StreamState =
  | { phase: 'idle' }
  | { phase: 'thinking' }
  | { phase: 'tool-call'; toolName: string; label: string }
  | { phase: 'streaming'; label: string | null };

export type LiveAssistant = {
  text: string;
  toolName: string | null;
  toolLabel: string | null;
  genieMeta: GenieMeta | null;
};

export function useStreamingChat(chatId: string) {
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [live, setLive] = useState<LiveAssistant | null>(null);
  const [state, setState] = useState<StreamState>({ phase: 'idle' });
  const liveRef = useRef<LiveAssistant>({
    text: '',
    toolName: null,
    toolLabel: null,
    genieMeta: null,
  });

  const reload = useCallback(async () => {
    if (!chatId) {
      setMessages([]);
      return;
    }
    setMessages(await fetchMessages(chatId));
  }, [chatId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const send = useCallback(
    async (text: string) => {
      setState({ phase: 'thinking' });
      liveRef.current = { text: '', toolName: null, toolLabel: null, genieMeta: null };
      setLive({ ...liveRef.current });

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message: text }),
      });

      if (!res.ok || !res.body) {
        setState({ phase: 'idle' });
        setLive(null);
        return;
      }

      // Optimistically show the user message (server already persisted it; reload at end syncs)
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const ev = JSON.parse(payload);
            handleEvent(ev);
          } catch {
            // skip malformed chunk
          }
        }
      }

      setState({ phase: 'idle' });
      setLive(null);
      await reload();

      function handleEvent(ev: { type: string; [k: string]: unknown }) {
        if (ev.type === 'text-delta') {
          liveRef.current.text += String(ev.delta ?? '');
          setLive({ ...liveRef.current });
          setState((s) =>
            s.phase === 'streaming' ? s : { phase: 'streaming', label: liveRef.current.toolLabel },
          );
        } else if (ev.type === 'tool-call') {
          liveRef.current.toolName = String(ev.toolName ?? '');
          liveRef.current.toolLabel = String(ev.label ?? ev.toolName ?? 'Genie');
          setLive({ ...liveRef.current });
          setState({
            phase: 'tool-call',
            toolName: liveRef.current.toolName,
            label: liveRef.current.toolLabel,
          });
        } else if (ev.type === 'tool-result') {
          // Keep current label; phase transitions on first text-delta.
        } else if (ev.type === 'data-genie-meta') {
          liveRef.current.genieMeta = ev.data as GenieMeta;
          const meta = liveRef.current.genieMeta;
          if (meta?.space_label) liveRef.current.toolLabel = meta.space_label;
          setLive({ ...liveRef.current });
        } else if (ev.type === 'error') {
          // Surface error in the live text and clean up
          liveRef.current.text += `\n\n[error: ${ev.message}]`;
          setLive({ ...liveRef.current });
        } else if (ev.type === 'finish') {
          // Server persists in the same path; reload happens after the stream loop exits
        }
      }
    },
    [chatId, reload],
  );

  return { messages, live, state, send };
}
