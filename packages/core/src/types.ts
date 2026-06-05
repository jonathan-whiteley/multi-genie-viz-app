export type SpaceConfig = {
  space_id: string;
  label: string;
  tags: string[];
  tool_name: string;
  suggested_questions: string[];
};

export type AppConfig = {
  spaces: SpaceConfig[];
};

export type ChatSummary = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MessageRole = 'user' | 'assistant' | 'system';

export type UIMessagePart =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; input: unknown }
  | { type: 'tool-result'; toolCallId: string; toolName: string; output: unknown }
  | { type: 'data-genie-meta'; data: GenieMeta }
  | { type: 'data-sql'; data: { sql: string } }
  | { type: 'data-result-rows'; data: { columns: string[]; rows: unknown[][] } };

export type GenieMeta = {
  genie_space_id: string;
  genie_conversation_id: string;
  genie_message_id: string;
  space_label?: string;
};

export type StoredMessage = {
  id: string;
  chatId: string;
  role: MessageRole;
  parts: UIMessagePart[];
  genieSpaceId: string | null;
  genieConversationId: string | null;
  genieMessageId: string | null;
  toolName: string | null;
  sqlQuery: string | null;
  resultData: { columns: string[]; rows: unknown[][] } | null;
  createdAt: string;
};

export type FeedbackRating = 'up' | 'down';

export type FeedbackRecord = {
  id: string;
  messageId: string;
  rating: FeedbackRating;
  comment: string | null;
  syncedAt: string | null;
  syncError: string | null;
};
