import type { StoredMessage, FeedbackRecord } from '@multi-genie/core';

export async function fetchMessages(chatId: string): Promise<StoredMessage[]> {
  const r = await fetch(`/api/chats/${chatId}/messages`);
  if (!r.ok) throw new Error(`fetchMessages ${r.status}`);
  return r.json();
}

export async function fetchFeedback(messageId: string): Promise<FeedbackRecord | null> {
  const r = await fetch(`/api/messages/${messageId}/feedback`);
  if (!r.ok) throw new Error(`fetchFeedback ${r.status}`);
  return r.json();
}

export async function submitFeedback(
  messageId: string,
  rating: 'up' | 'down',
  comment?: string,
) {
  const r = await fetch(`/api/messages/${messageId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating, comment }),
  });
  return r.json() as Promise<{
    ok: boolean;
    syncedToGenie: boolean;
    syncError?: string;
  }>;
}

export async function clearFeedback(messageId: string) {
  await fetch(`/api/messages/${messageId}/feedback`, { method: 'DELETE' });
}
