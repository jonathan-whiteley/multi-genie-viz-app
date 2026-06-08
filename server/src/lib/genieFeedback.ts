import type { FeedbackRating } from '@multi-genie/core';

const DEFAULT_PATH =
  '/api/2.0/genie/spaces/{space_id}/conversations/{conversation_id}/messages/{message_id}/feedback';

export type SubmitGenieFeedbackInput = {
  host: string;
  accessToken: string;
  spaceId: string;
  conversationId: string;
  messageId: string;
  rating: FeedbackRating;
  comment?: string;
  pathOverride?: string;
  fetchImpl?: typeof fetch;
};

export type SubmitGenieFeedbackResult = { ok: true } | { ok: false; error: string };

export async function submitGenieFeedback(
  input: SubmitGenieFeedbackInput,
): Promise<SubmitGenieFeedbackResult> {
  const path = (input.pathOverride ?? DEFAULT_PATH)
    .replace('{space_id}', input.spaceId)
    .replace('{conversation_id}', input.conversationId)
    .replace('{message_id}', input.messageId);
  const url = `${input.host.replace(/\/$/, '')}${path}`;
  const body: Record<string, string> = {
    rating: input.rating === 'up' ? 'positive' : 'negative',
  };
  if (input.comment) body.comment = input.comment;
  const f = input.fetchImpl ?? fetch;
  const res = await f(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, error: `${res.status} ${text}`.trim() };
  }
  return { ok: true };
}
