import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '../connection.js';
import {
  upsertUserByEmail,
  createChat,
  listChats,
  getChat,
  deleteChat,
  appendMessage,
  listMessages,
  upsertFeedback,
  getFeedbackForMessage,
} from '../queries.js';
import { sql } from 'drizzle-orm';

const db = getDb();

beforeEach(async () => {
  await db.execute(sql`TRUNCATE app."User" CASCADE`);
});

describe('user', () => {
  it('upserts by email returning a stable id', async () => {
    const u1 = await upsertUserByEmail('a@b.com');
    const u2 = await upsertUserByEmail('a@b.com');
    expect(u1.id).toBe(u2.id);
  });
});

describe('chats', () => {
  it('creates and lists newest-first', async () => {
    const u = await upsertUserByEmail('a@b.com');
    const c1 = await createChat(u.id, 'first');
    // touch c1 backward in time so c2 is clearly newer
    await new Promise((r) => setTimeout(r, 10));
    const c2 = await createChat(u.id, 'second');
    const chats = await listChats(u.id);
    expect(chats[0]!.id).toBe(c2.id);
    expect(chats[1]!.id).toBe(c1.id);
  });

  it('scopes to user', async () => {
    const u1 = await upsertUserByEmail('a@b.com');
    const u2 = await upsertUserByEmail('c@d.com');
    await createChat(u1.id, 't');
    const chats = await listChats(u2.id);
    expect(chats).toHaveLength(0);
  });

  it('deletes chat cascades messages', async () => {
    const u = await upsertUserByEmail('a@b.com');
    const c = await createChat(u.id, 't');
    await appendMessage(c.id, { role: 'user', parts: [{ type: 'text', text: 'hi' }] });
    await deleteChat(c.id, u.id);
    expect(await getChat(c.id, u.id)).toBeNull();
  });
});

describe('messages', () => {
  it('appends and lists in created order', async () => {
    const u = await upsertUserByEmail('a@b.com');
    const c = await createChat(u.id, 't');
    await appendMessage(c.id, { role: 'user', parts: [{ type: 'text', text: 'q' }] });
    await appendMessage(c.id, {
      role: 'assistant',
      parts: [{ type: 'text', text: 'a' }],
      genieSpaceId: 'sp1',
      toolName: 'finance_genie',
    });
    const msgs = await listMessages(c.id);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]!.role).toBe('user');
    expect(msgs[1]!.genieSpaceId).toBe('sp1');
  });

  it('stores assistant message with partial Genie metadata (degraded MAS case)', async () => {
    const u = await upsertUserByEmail('a@b.com');
    const c = await createChat(u.id, 't');
    const m = await appendMessage(c.id, {
      role: 'assistant',
      parts: [{ type: 'text', text: 'a' }],
      genieSpaceId: 'sp1',
      toolName: 'finance_genie',
    });
    expect(m.genieSpaceId).toBe('sp1');
    expect(m.genieConversationId).toBeNull();
    expect(m.genieMessageId).toBeNull();
  });
});

describe('feedback', () => {
  it('upserts feedback for a message with full Genie metadata', async () => {
    const u = await upsertUserByEmail('a@b.com');
    const c = await createChat(u.id, 't');
    const m = await appendMessage(c.id, {
      role: 'assistant',
      parts: [{ type: 'text', text: 'a' }],
      genieSpaceId: 'sp1',
      genieConversationId: 'cv1',
      genieMessageId: 'mg1',
    });
    await upsertFeedback({ messageId: m.id, userId: u.id, rating: 'up' });
    const fb = await getFeedbackForMessage(m.id, u.id);
    expect(fb?.rating).toBe('up');
    expect(fb?.genieSpaceId).toBe('sp1');
    expect(fb?.genieConversationId).toBe('cv1');
    expect(fb?.genieMessageId).toBe('mg1');
  });

  it('upserts feedback for a message with only genieSpaceId (degraded case)', async () => {
    const u = await upsertUserByEmail('a@b.com');
    const c = await createChat(u.id, 't');
    const m = await appendMessage(c.id, {
      role: 'assistant',
      parts: [{ type: 'text', text: 'a' }],
      genieSpaceId: 'sp1',
    });
    await upsertFeedback({ messageId: m.id, userId: u.id, rating: 'up' });
    const fb = await getFeedbackForMessage(m.id, u.id);
    expect(fb?.rating).toBe('up');
    expect(fb?.genieSpaceId).toBe('sp1');
    expect(fb?.genieConversationId).toBeNull();
    expect(fb?.genieMessageId).toBeNull();
  });

  it('replaces feedback on conflict (same user + message)', async () => {
    const u = await upsertUserByEmail('a@b.com');
    const c = await createChat(u.id, 't');
    const m = await appendMessage(c.id, {
      role: 'assistant',
      parts: [{ type: 'text', text: 'a' }],
      genieSpaceId: 'sp1',
    });
    await upsertFeedback({ messageId: m.id, userId: u.id, rating: 'up' });
    await upsertFeedback({ messageId: m.id, userId: u.id, rating: 'down', comment: 'wrong' });
    const fb = await getFeedbackForMessage(m.id, u.id);
    expect(fb?.rating).toBe('down');
    expect(fb?.comment).toBe('wrong');
  });

  it('throws when message does not exist', async () => {
    const u = await upsertUserByEmail('a@b.com');
    await expect(
      upsertFeedback({ messageId: '00000000-0000-0000-0000-000000000000', userId: u.id, rating: 'up' }),
    ).rejects.toThrow(/not found/);
  });
});
