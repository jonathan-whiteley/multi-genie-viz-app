import {
  pgSchema,
  uuid,
  text,
  varchar,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const appSchema = pgSchema('app');

export const user = appSchema.table('User', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
});

export const chat = appSchema.table(
  'Chat',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUserUpdated: index('chat_user_updated_idx').on(t.userId, t.updatedAt.desc()),
  }),
);

export const message = appSchema.table(
  'Message',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
    role: varchar('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
    parts: jsonb('parts').notNull(),
    genieSpaceId: text('genieSpaceId'),
    genieConversationId: text('genieConversationId'),
    genieMessageId: text('genieMessageId'),
    toolName: text('toolName'),
    sqlQuery: text('sqlQuery'),
    resultData: jsonb('resultData'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byChatCreated: index('message_chat_created_idx').on(t.chatId, t.createdAt),
  }),
);

export const feedback = appSchema.table(
  'Feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('messageId')
      .notNull()
      .references(() => message.id, { onDelete: 'cascade' }),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    rating: varchar('rating', { enum: ['up', 'down'] }).notNull(),
    comment: text('comment'),
    // Genie routing IDs are NULLABLE: MAS does not emit them today. genieSpaceId comes from
    // a tool_name -> space_id config map when available; the other two stay null until the
    // MAS supervisor is updated to populate custom_outputs.
    genieSpaceId: text('genieSpaceId'),
    genieConversationId: text('genieConversationId'),
    genieMessageId: text('genieMessageId'),
    syncedAt: timestamp('syncedAt', { withTimezone: true }),
    syncError: text('syncError'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byMessageUser: uniqueIndex('feedback_message_user_idx').on(t.messageId, t.userId),
  }),
);
