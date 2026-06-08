import { describe, it, expect, vi } from 'vitest';
import { submitGenieFeedback } from '../genieFeedback.js';

describe('submitGenieFeedback', () => {
  it('POSTs to the per-space feedback endpoint with the OBO token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('') });
    const res = await submitGenieFeedback({
      host: 'https://example.cloud.databricks.com',
      accessToken: 'tok-123',
      spaceId: 'sp1',
      conversationId: 'cv1',
      messageId: 'mg1',
      rating: 'up',
      comment: 'great',
      fetchImpl: fetchMock,
    });
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.cloud.databricks.com/api/2.0/genie/spaces/sp1/conversations/cv1/messages/mg1/feedback');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok-123');
    expect(JSON.parse(init.body)).toEqual({ rating: 'positive', comment: 'great' });
  });

  it('maps "down" to "negative"', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('') });
    await submitGenieFeedback({
      host: 'https://h', accessToken: 't', spaceId: 's', conversationId: 'c', messageId: 'm',
      rating: 'down', fetchImpl: fetchMock,
    });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).rating).toBe('negative');
  });

  it('omits comment when not provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('') });
    await submitGenieFeedback({
      host: 'https://h', accessToken: 't', spaceId: 's', conversationId: 'c', messageId: 'm',
      rating: 'up', fetchImpl: fetchMock,
    });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body).toEqual({ rating: 'positive' });
    expect(body).not.toHaveProperty('comment');
  });

  it('returns ok=false with status text on non-2xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve('not found') });
    const res = await submitGenieFeedback({
      host: 'https://h', accessToken: 't', spaceId: 's', conversationId: 'c', messageId: 'm',
      rating: 'up', fetchImpl: fetchMock,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('404');
    expect(res.error).toContain('not found');
  });

  it('respects pathOverride template', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('') });
    await submitGenieFeedback({
      host: 'https://h', accessToken: 't', spaceId: 's', conversationId: 'c', messageId: 'm',
      rating: 'up',
      pathOverride: '/api/3.0/genie/{space_id}/{conversation_id}/{message_id}/rating',
      fetchImpl: fetchMock,
    });
    expect(fetchMock.mock.calls[0]![0]).toBe('https://h/api/3.0/genie/s/c/m/rating');
  });

  it('strips trailing slash from host', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('') });
    await submitGenieFeedback({
      host: 'https://h/', accessToken: 't', spaceId: 's', conversationId: 'c', messageId: 'm',
      rating: 'up', fetchImpl: fetchMock,
    });
    const url = fetchMock.mock.calls[0]![0];
    expect(url.startsWith('https://h/api/')).toBe(true);
    expect(url.startsWith('https://h//api/')).toBe(false);
  });
});
