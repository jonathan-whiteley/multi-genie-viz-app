var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/src/index.ts
import express from "express";
import "dotenv/config";

// packages/auth/src/obo.ts
function normalize(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v === "string") out[k.toLowerCase()] = v;
  }
  return out;
}
function parseOboHeaders(headers) {
  const h = normalize(headers);
  const email = h["x-forwarded-email"];
  const accessToken = h["x-forwarded-access-token"];
  const username = h["x-forwarded-user"] ?? email?.split("@")[0] ?? "";
  if (!email || !accessToken) return null;
  return { email, username, accessToken };
}

// packages/db/src/schema.ts
var schema_exports = {};
__export(schema_exports, {
  appSchema: () => appSchema,
  chat: () => chat,
  feedback: () => feedback,
  message: () => message,
  user: () => user
});
import {
  pgSchema,
  uuid,
  text,
  varchar,
  timestamp,
  jsonb,
  uniqueIndex,
  index
} from "drizzle-orm/pg-core";
var appSchema = pgSchema("app");
var user = appSchema.table("User", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow()
});
var chat = appSchema.table(
  "Chat",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
    title: text("title"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    byUserUpdated: index("chat_user_updated_idx").on(t.userId, t.updatedAt.desc())
  })
);
var message = appSchema.table(
  "Message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chatId: uuid("chatId").notNull().references(() => chat.id, { onDelete: "cascade" }),
    role: varchar("role", { enum: ["user", "assistant", "system"] }).notNull(),
    parts: jsonb("parts").notNull(),
    genieSpaceId: text("genieSpaceId"),
    genieConversationId: text("genieConversationId"),
    genieMessageId: text("genieMessageId"),
    toolName: text("toolName"),
    sqlQuery: text("sqlQuery"),
    resultData: jsonb("resultData"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    byChatCreated: index("message_chat_created_idx").on(t.chatId, t.createdAt)
  })
);
var feedback = appSchema.table(
  "Feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("messageId").notNull().references(() => message.id, { onDelete: "cascade" }),
    userId: uuid("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
    rating: varchar("rating", { enum: ["up", "down"] }).notNull(),
    comment: text("comment"),
    // Genie routing IDs are NULLABLE: MAS does not emit them today. genieSpaceId comes from
    // a tool_name -> space_id config map when available; the other two stay null until the
    // MAS supervisor is updated to populate custom_outputs.
    genieSpaceId: text("genieSpaceId"),
    genieConversationId: text("genieConversationId"),
    genieMessageId: text("genieMessageId"),
    syncedAt: timestamp("syncedAt", { withTimezone: true }),
    syncError: text("syncError"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    byMessageUser: uniqueIndex("feedback_message_user_idx").on(t.messageId, t.userId)
  })
);

// packages/db/src/connection.ts
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
var _db = null;
function getDb() {
  if (_db) return _db;
  const host = process.env.PGHOST ?? process.env.LAKEBASE_HOST;
  const database = process.env.PGDATABASE ?? process.env.LAKEBASE_DATABASE;
  const user2 = process.env.PGUSER ?? process.env.LAKEBASE_USER;
  const password = process.env.PGPASSWORD ?? process.env.LAKEBASE_PASSWORD;
  if (!host || !database || !user2 || !password) {
    throw new Error("Database env vars required: PGHOST/PGDATABASE/PGUSER/PGPASSWORD (or LAKEBASE_* for local dev)");
  }
  const ssl = process.env.PGSSLMODE ?? process.env.LAKEBASE_SSL ?? "require";
  const client = postgres({
    host,
    database,
    user: user2,
    password,
    port: Number(process.env.PGPORT ?? 5432),
    ssl,
    max: 10
  });
  _db = drizzle(client, { schema: schema_exports });
  return _db;
}

// packages/db/src/queries.ts
import { eq, desc, and } from "drizzle-orm";
var db = () => getDb();
async function upsertUserByEmail(email) {
  const existing = await db().select().from(user).where(eq(user.email, email)).limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db().insert(user).values({ email }).returning();
  return created;
}
async function createChat(userId, title = null) {
  const [created] = await db().insert(chat).values({ userId, title }).returning();
  return created;
}
async function listChats(userId) {
  return db().select().from(chat).where(eq(chat.userId, userId)).orderBy(desc(chat.updatedAt));
}
async function getChat(chatId, userId) {
  const rows = await db().select().from(chat).where(and(eq(chat.id, chatId), eq(chat.userId, userId))).limit(1);
  return rows[0] ?? null;
}
async function deleteChat(chatId, userId) {
  await db().delete(chat).where(and(eq(chat.id, chatId), eq(chat.userId, userId)));
}
async function touchChat(chatId) {
  await db().update(chat).set({ updatedAt: /* @__PURE__ */ new Date() }).where(eq(chat.id, chatId));
}
async function setChatTitle(chatId, title) {
  await db().update(chat).set({ title }).where(eq(chat.id, chatId));
}
async function appendMessage(chatId, m) {
  const [created] = await db().insert(message).values({
    chatId,
    role: m.role,
    parts: m.parts,
    genieSpaceId: m.genieSpaceId ?? null,
    genieConversationId: m.genieConversationId ?? null,
    genieMessageId: m.genieMessageId ?? null,
    toolName: m.toolName ?? null,
    sqlQuery: m.sqlQuery ?? null,
    resultData: m.resultData ?? null
  }).returning();
  await touchChat(chatId);
  return created;
}
async function listMessages(chatId) {
  return db().select().from(message).where(eq(message.chatId, chatId)).orderBy(message.createdAt);
}
async function getMessage(messageId) {
  const rows = await db().select().from(message).where(eq(message.id, messageId)).limit(1);
  return rows[0] ?? null;
}
async function upsertFeedback(f) {
  const msg = await getMessage(f.messageId);
  if (!msg) throw new Error(`message ${f.messageId} not found`);
  const [row] = await db().insert(feedback).values({
    messageId: f.messageId,
    userId: f.userId,
    rating: f.rating,
    comment: f.comment ?? null,
    genieSpaceId: msg.genieSpaceId,
    genieConversationId: msg.genieConversationId,
    genieMessageId: msg.genieMessageId
  }).onConflictDoUpdate({
    target: [feedback.messageId, feedback.userId],
    set: {
      rating: f.rating,
      comment: f.comment ?? null,
      syncedAt: null,
      syncError: null
    }
  }).returning();
  return row;
}
async function markFeedbackSynced(feedbackId) {
  await db().update(feedback).set({ syncedAt: /* @__PURE__ */ new Date(), syncError: null }).where(eq(feedback.id, feedbackId));
}
async function markFeedbackError(feedbackId, errMsg) {
  await db().update(feedback).set({ syncError: errMsg.slice(0, 500) }).where(eq(feedback.id, feedbackId));
}
async function getFeedbackForMessage(messageId, userId) {
  const rows = await db().select().from(feedback).where(and(eq(feedback.messageId, messageId), eq(feedback.userId, userId))).limit(1);
  return rows[0] ?? null;
}
async function clearFeedback(messageId, userId) {
  await db().delete(feedback).where(and(eq(feedback.messageId, messageId), eq(feedback.userId, userId)));
}

// server/src/middleware/auth.ts
async function authMiddleware(req, res, next) {
  const session = parseOboHeaders(req.headers);
  if (!session) {
    if (process.env.NODE_ENV !== "production" && process.env.DEV_EMAIL) {
      const email = process.env.DEV_EMAIL;
      const u2 = await upsertUserByEmail(email);
      req.session = {
        email,
        username: email.split("@")[0] ?? email,
        accessToken: process.env.DATABRICKS_TOKEN ?? ""
      };
      req.userId = u2.id;
      next();
      return;
    }
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const u = await upsertUserByEmail(session.email);
  req.session = session;
  req.userId = u.id;
  next();
}

// server/src/routes/config.ts
import { Router } from "express";
var configRouter = Router();
configRouter.get("/api/config", (_req, res) => {
  const raw = process.env.GENIE_SPACES_JSON ?? "[]";
  let spaces = [];
  try {
    spaces = JSON.parse(raw);
  } catch (e) {
    res.status(500).json({ error: `GENIE_SPACES_JSON parse error: ${e.message}` });
    return;
  }
  const cfg = { spaces };
  res.json(cfg);
});

// server/src/routes/history.ts
import { Router as Router2 } from "express";
import { z } from "zod";
var historyRouter = Router2();
historyRouter.get("/api/chats", async (req, res) => {
  const chats = await listChats(req.userId);
  res.json(chats);
});
historyRouter.post("/api/chats", async (req, res) => {
  const body = z.object({ title: z.string().optional() }).parse(req.body ?? {});
  const c = await createChat(req.userId, body.title ?? null);
  res.status(201).json(c);
});
historyRouter.get("/api/chats/:id", async (req, res) => {
  const c = await getChat(req.params.id, req.userId);
  if (!c) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(c);
});
historyRouter.get("/api/chats/:id/messages", async (req, res) => {
  const c = await getChat(req.params.id, req.userId);
  if (!c) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const msgs = await listMessages(req.params.id);
  res.json(msgs);
});
historyRouter.delete("/api/chats/:id", async (req, res) => {
  await deleteChat(req.params.id, req.userId);
  res.status(204).end();
});

// server/src/routes/chat.ts
import { Router as Router3 } from "express";
import { z as z2 } from "zod";

// server/src/lib/parseStreamMeta.ts
var NAME_TAG = /^<name>(.+?)<\/name>$/;
function classifyChunk(chunk) {
  if (!chunk || typeof chunk !== "object") return { kind: "unknown", raw: chunk };
  const c = chunk;
  if (c["type"] === "response.output_text.delta") {
    return {
      kind: "text-delta",
      text: String(c["delta"] ?? ""),
      ...typeof c["step"] === "number" ? { step: c["step"] } : {}
    };
  }
  if (c["type"] === "response.output_item.done" && c["item"] && typeof c["item"] === "object") {
    const item = c["item"];
    if (item["type"] === "function_call") {
      return {
        kind: "tool-call",
        callId: String(item["call_id"] ?? ""),
        toolName: String(item["name"] ?? ""),
        argumentsRaw: String(item["arguments"] ?? ""),
        ...typeof item["step"] === "number" ? { step: item["step"] } : {}
      };
    }
    if (item["type"] === "message") {
      const callId = typeof item["call_id"] === "string" ? item["call_id"] : null;
      const text2 = extractMessageText(item);
      if (callId) {
        return { kind: "tool-result", callId, text: text2 };
      }
      const nameMatch = NAME_TAG.exec(text2.trim());
      if (nameMatch && nameMatch[1]) {
        return { kind: "name-artifact", toolName: nameMatch[1] };
      }
      return {
        kind: "message-final",
        text: text2,
        ...typeof c["step"] === "number" ? { step: c["step"] } : {}
      };
    }
  }
  return { kind: "unknown", raw: chunk };
}
function extractMessageText(item) {
  const content = item["content"];
  if (!Array.isArray(content)) return "";
  return content.filter(
    (p) => !!p && typeof p === "object" && p["type"] === "output_text" && typeof p["text"] === "string"
  ).map((p) => p.text).join("");
}
function deepFind(obj, keys) {
  if (!obj || typeof obj !== "object") return void 0;
  const o = obj;
  for (const k of keys) {
    if (k in o && o[k] !== void 0 && o[k] !== null) return o[k];
  }
  for (const v of Object.values(o)) {
    if (v && typeof v === "object") {
      const found = deepFind(v, keys);
      if (found !== void 0) return found;
    }
  }
  return void 0;
}
function extractGenieMeta(toolOutput) {
  const space_id = deepFind(toolOutput, ["genie_space_id"]);
  const conversation_id = deepFind(toolOutput, ["genie_conversation_id"]);
  const message_id = deepFind(toolOutput, ["genie_message_id"]);
  if (!space_id || !conversation_id || !message_id) return null;
  return {
    genie_space_id: space_id,
    genie_conversation_id: conversation_id,
    genie_message_id: message_id
  };
}
function resolveSpaceLabel(spaces, spaceId, toolName) {
  if (spaceId) {
    const bySpace = spaces.find((s) => s.space_id === spaceId);
    if (bySpace) return bySpace.label;
  }
  if (toolName) {
    const byTool = spaces.find((s) => s.tool_name === toolName);
    if (byTool) return byTool.label;
  }
  return "Genie";
}
function stripNameArtifacts(text2) {
  return text2.replace(/<name>.*?<\/name>/g, "");
}

// server/src/routes/chat.ts
var chatRouter = Router3();
var bodySchema = z2.object({
  chatId: z2.string().uuid(),
  message: z2.string().min(1).max(8e3)
});
function loadSpaces() {
  try {
    return JSON.parse(process.env.GENIE_SPACES_JSON ?? "[]");
  } catch {
    return [];
  }
}
function textOnly(parts) {
  return parts.filter((p) => p.type === "text").map((p) => p.text).join("\n");
}
chatRouter.post("/api/chat", async (req, res) => {
  const { chatId, message: message2 } = bodySchema.parse(req.body);
  const chat2 = await getChat(chatId, req.userId);
  if (!chat2) {
    res.status(404).json({ error: "chat not found" });
    return;
  }
  await appendMessage(chatId, {
    role: "user",
    parts: [{ type: "text", text: message2 }]
  });
  if (!chat2.title) {
    await setChatTitle(chatId, message2.slice(0, 64));
  }
  const history = await listMessages(chatId);
  const inputMessages = history.map((m) => ({
    role: m.role,
    content: textOnly(m.parts)
  }));
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}

`);
  const spaces = loadSpaces();
  let textBuf = "";
  let toolName = null;
  let toolCallId = null;
  let toolResultText = null;
  let genieMeta = null;
  const host = process.env.DATABRICKS_HOST;
  const endpoint = process.env.MAS_ENDPOINT_NAME;
  const url = `${host.replace(/\/$/, "")}/serving-endpoints/${endpoint}/invocations`;
  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${req.session.accessToken}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream"
      },
      body: JSON.stringify({ input: inputMessages, stream: true })
    });
    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => "");
      send({ type: "error", message: `MAS endpoint ${upstream.status}: ${errText.slice(0, 500)}` });
      res.end();
      return;
    }
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;
        if (payload === "[DONE]") continue;
        let chunk;
        try {
          chunk = JSON.parse(payload);
        } catch {
          continue;
        }
        const classified = classifyChunk(chunk);
        switch (classified.kind) {
          case "text-delta": {
            const clean = stripNameArtifacts(classified.text);
            if (clean) {
              textBuf += clean;
              send({ type: "text-delta", delta: clean });
            }
            break;
          }
          case "tool-call": {
            toolName = classified.toolName;
            toolCallId = classified.callId;
            const label = resolveSpaceLabel(spaces, null, toolName);
            send({
              type: "tool-call",
              toolCallId: classified.callId,
              toolName: classified.toolName,
              label
            });
            break;
          }
          case "tool-result": {
            if (toolCallId && classified.callId === toolCallId) {
              toolResultText = classified.text;
            }
            const maybeMeta = extractGenieMeta(chunk);
            if (maybeMeta) {
              genieMeta = maybeMeta;
              const label = resolveSpaceLabel(spaces, maybeMeta.genie_space_id, toolName);
              send({
                type: "data-genie-meta",
                data: { ...maybeMeta, space_label: label }
              });
            }
            send({
              type: "tool-result",
              toolCallId: classified.callId,
              toolName: toolName ?? null
            });
            break;
          }
          case "name-artifact":
            break;
          case "message-final":
            if (!textBuf) {
              textBuf = stripNameArtifacts(classified.text);
            }
            break;
          case "unknown":
            break;
        }
      }
    }
    const assembled = textBuf ? [{ type: "text", text: textBuf }] : [];
    await appendMessage(chatId, {
      role: "assistant",
      parts: assembled,
      genieSpaceId: genieMeta?.genie_space_id ?? toolNameToSpaceId(spaces, toolName) ?? void 0,
      genieConversationId: genieMeta?.genie_conversation_id ?? void 0,
      genieMessageId: genieMeta?.genie_message_id ?? void 0,
      toolName: toolName ?? void 0,
      // Tool result text often contains a markdown table for Genie answers; preserve as resultData if parseable
      ...toolResultText ? { resultData: tryParseMarkdownTable(toolResultText) ?? void 0 } : {}
    });
    send({ type: "finish" });
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    send({ type: "error", message: err.message });
    res.end();
  }
});
function toolNameToSpaceId(spaces, toolName) {
  if (!toolName) return null;
  const s = spaces.find((sp) => sp.tool_name === toolName);
  return s?.space_id ?? null;
}
function tryParseMarkdownTable(text2) {
  const lines = text2.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const headerLine = lines[0];
  const separatorLine = lines[1];
  if (!/^\|?(\s*[-:]+\s*\|)+\s*[-:]*\s*\|?$/.test(separatorLine)) return null;
  const parseRow = (line) => line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const columns = parseRow(headerLine);
  const rows = lines.slice(2).map(parseRow);
  return { columns, rows };
}

// server/src/routes/feedback.ts
import { Router as Router4 } from "express";
import { z as z3 } from "zod";

// server/src/lib/genieFeedback.ts
var DEFAULT_PATH = "/api/2.0/genie/spaces/{space_id}/conversations/{conversation_id}/messages/{message_id}/feedback";
async function submitGenieFeedback(input) {
  const path2 = (input.pathOverride ?? DEFAULT_PATH).replace("{space_id}", input.spaceId).replace("{conversation_id}", input.conversationId).replace("{message_id}", input.messageId);
  const url = `${input.host.replace(/\/$/, "")}${path2}`;
  const body = {
    rating: input.rating === "up" ? "positive" : "negative"
  };
  if (input.comment) body.comment = input.comment;
  const f = input.fetchImpl ?? fetch;
  const res = await f(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text2 = await res.text().catch(() => "");
    return { ok: false, error: `${res.status} ${text2}`.trim() };
  }
  return { ok: true };
}

// server/src/routes/feedback.ts
var feedbackRouter = Router4();
var postSchema = z3.object({
  rating: z3.enum(["up", "down"]),
  comment: z3.string().max(2e3).optional()
});
feedbackRouter.post("/api/messages/:id/feedback", async (req, res) => {
  const messageId = req.params.id;
  const { rating, comment } = postSchema.parse(req.body);
  const msg = await getMessage(messageId);
  if (!msg) {
    res.status(404).json({ error: "message not found" });
    return;
  }
  const fb = await upsertFeedback({
    messageId,
    userId: req.userId,
    rating,
    comment
  });
  if (!msg.genieSpaceId || !msg.genieConversationId || !msg.genieMessageId) {
    const reason = "awaiting MAS upstream update for Genie conversation/message IDs";
    await markFeedbackError(fb.id, reason);
    res.json({ ok: true, syncedToGenie: false, syncError: reason });
    return;
  }
  const sync = await submitGenieFeedback({
    host: process.env.DATABRICKS_HOST,
    accessToken: req.session.accessToken,
    spaceId: msg.genieSpaceId,
    conversationId: msg.genieConversationId,
    messageId: msg.genieMessageId,
    rating,
    comment,
    pathOverride: process.env.GENIE_FEEDBACK_PATH
  });
  if (sync.ok) {
    await markFeedbackSynced(fb.id);
    res.json({ ok: true, syncedToGenie: true });
  } else {
    await markFeedbackError(fb.id, sync.error);
    res.json({ ok: true, syncedToGenie: false, syncError: sync.error });
  }
});
feedbackRouter.get("/api/messages/:id/feedback", async (req, res) => {
  const fb = await getFeedbackForMessage(req.params.id, req.userId);
  res.json(fb ?? null);
});
feedbackRouter.delete("/api/messages/:id/feedback", async (req, res) => {
  await clearFeedback(req.params.id, req.userId);
  res.status(204).end();
});

// server/src/index.ts
import path from "node:path";
import { fileURLToPath } from "node:url";
var app = express();
var __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({ limit: "4mb" }));
app.use(authMiddleware);
app.use(configRouter);
app.use(historyRouter);
app.use(chatRouter);
app.use(feedbackRouter);
if (process.env.NODE_ENV === "production") {
  const clientDist = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.use((_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}
var port = Number(process.env.PORT ?? 8e3);
app.listen(port, () => {
  console.log(`server listening on :${port}`);
});
