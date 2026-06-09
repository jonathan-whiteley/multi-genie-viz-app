import { eq, desc, and } from 'drizzle-orm';
import { getDb } from './connection.js';
import { user, chat, message, feedback } from './schema.js';
import type { UIMessagePart, MessageRole, FeedbackRating } from '@multi-genie/core';

export async function upsertUserByEmail(email: string) {
  const db = await getDb();
  const existing = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db.insert(user).values({ email }).returning();
  return created!;
}

export async function createChat(userId: string, title: string | null = null) {
  const db = await getDb();
  const [created] = await db.insert(chat).values({ userId, title }).returning();
  return created!;
}

export async function listChats(userId: string) {
  const db = await getDb();
  return db.select().from(chat).where(eq(chat.userId, userId)).orderBy(desc(chat.updatedAt));
}

export async function getChat(chatId: string, userId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteChat(chatId: string, userId: string) {
  const db = await getDb();
  await db.delete(chat).where(and(eq(chat.id, chatId), eq(chat.userId, userId)));
}

export async function touchChat(chatId: string) {
  const db = await getDb();
  await db.update(chat).set({ updatedAt: new Date() }).where(eq(chat.id, chatId));
}

export async function setChatTitle(chatId: string, title: string) {
  const db = await getDb();
  await db.update(chat).set({ title }).where(eq(chat.id, chatId));
}

type AppendMessageInput = {
  role: MessageRole;
  parts: UIMessagePart[];
  genieSpaceId?: string;
  genieConversationId?: string;
  genieMessageId?: string;
  toolName?: string;
  sqlQuery?: string;
  resultData?: { columns: string[]; rows: unknown[][] };
};

export async function appendMessage(chatId: string, m: AppendMessageInput) {
  const db = await getDb();
  const [created] = await db
    .insert(message)
    .values({
      chatId,
      role: m.role,
      parts: m.parts,
      genieSpaceId: m.genieSpaceId ?? null,
      genieConversationId: m.genieConversationId ?? null,
      genieMessageId: m.genieMessageId ?? null,
      toolName: m.toolName ?? null,
      sqlQuery: m.sqlQuery ?? null,
      resultData: m.resultData ?? null,
    })
    .returning();
  await touchChat(chatId);
  return created!;
}

export async function listMessages(chatId: string) {
  const db = await getDb();
  return db
    .select()
    .from(message)
    .where(eq(message.chatId, chatId))
    .orderBy(message.createdAt);
}

export async function getMessage(messageId: string) {
  const db = await getDb();
  const rows = await db.select().from(message).where(eq(message.id, messageId)).limit(1);
  return rows[0] ?? null;
}

type UpsertFeedbackInput = {
  messageId: string;
  userId: string;
  rating: FeedbackRating;
  comment?: string;
};

export async function upsertFeedback(f: UpsertFeedbackInput) {
  const msg = await getMessage(f.messageId);
  if (!msg) throw new Error(`message ${f.messageId} not found`);
  const db = await getDb();
  const [row] = await db
    .insert(feedback)
    .values({
      messageId: f.messageId,
      userId: f.userId,
      rating: f.rating,
      comment: f.comment ?? null,
      genieSpaceId: msg.genieSpaceId,
      genieConversationId: msg.genieConversationId,
      genieMessageId: msg.genieMessageId,
    })
    .onConflictDoUpdate({
      target: [feedback.messageId, feedback.userId],
      set: {
        rating: f.rating,
        comment: f.comment ?? null,
        syncedAt: null,
        syncError: null,
      },
    })
    .returning();
  return row!;
}

export async function markFeedbackSynced(feedbackId: string) {
  const db = await getDb();
  await db
    .update(feedback)
    .set({ syncedAt: new Date(), syncError: null })
    .where(eq(feedback.id, feedbackId));
}

export async function markFeedbackError(feedbackId: string, errMsg: string) {
  const db = await getDb();
  await db
    .update(feedback)
    .set({ syncError: errMsg.slice(0, 500) })
    .where(eq(feedback.id, feedbackId));
}

export async function getFeedbackForMessage(messageId: string, userId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(feedback)
    .where(and(eq(feedback.messageId, messageId), eq(feedback.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function clearFeedback(messageId: string, userId: string) {
  const db = await getDb();
  await db
    .delete(feedback)
    .where(and(eq(feedback.messageId, messageId), eq(feedback.userId, userId)));
}
