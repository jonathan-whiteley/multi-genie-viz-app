import { Router } from 'express';
import { z } from 'zod';
import {
  appendMessage,
  getChat,
  listMessages,
  setChatTitle,
} from '@multi-genie/db';
import type { SpaceConfig, UIMessagePart } from '@multi-genie/core';
import {
  classifyChunk,
  extractGenieMeta,
  resolveSpaceLabel,
  stripNameArtifacts,
} from '../lib/parseStreamMeta.js';

export const chatRouter = Router();

const bodySchema = z.object({
  chatId: z.string().uuid(),
  message: z.string().min(1).max(8000),
});

function loadSpaces(): SpaceConfig[] {
  try {
    return JSON.parse(process.env.GENIE_SPACES_JSON ?? '[]');
  } catch {
    return [];
  }
}

function textOnly(parts: UIMessagePart[]): string {
  return parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

chatRouter.post('/api/chat', async (req, res) => {
  const { chatId, message } = bodySchema.parse(req.body);

  const chat = await getChat(chatId, req.userId!);
  if (!chat) {
    res.status(404).json({ error: 'chat not found' });
    return;
  }

  // Persist user message
  await appendMessage(chatId, {
    role: 'user',
    parts: [{ type: 'text', text: message }],
  });

  // Set title on first message if absent
  if (!chat.title) {
    await setChatTitle(chatId, message.slice(0, 64));
  }

  // Build the Responses API input from history (text-only role/content pairs)
  const history = await listMessages(chatId);
  const inputMessages = history.map((m) => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: textOnly(m.parts as UIMessagePart[]),
  }));

  // Set up SSE response to client
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const spaces = loadSpaces();

  // State accumulated across the stream for final-message persistence
  let textBuf = '';
  let toolName: string | null = null;
  let toolCallId: string | null = null;
  let toolResultText: string | null = null;
  let genieMeta: ReturnType<typeof extractGenieMeta> = null;

  const host = process.env.DATABRICKS_HOST;
  const endpoint = process.env.MAS_ENDPOINT_NAME;
  console.log(
    `[chat] pre-fetch: host=${host ? 'set' : 'MISSING'} endpoint=${endpoint ?? 'MISSING'} ` +
      `hasToken=${!!req.session?.accessToken} historyLen=${inputMessages.length}`,
  );
  if (!host || !endpoint) {
    send({ type: 'error', message: `server misconfigured: DATABRICKS_HOST=${!!host} MAS_ENDPOINT_NAME=${!!endpoint}` });
    res.end();
    return;
  }
  const normalizedHost = host.startsWith('http') ? host : `https://${host}`;
  const url = `${normalizedHost.replace(/\/$/, '')}/serving-endpoints/${endpoint}/invocations`;

  try {
    console.log(`[chat] fetching ${url}`);
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${req.session!.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ input: inputMessages, stream: true }),
    });

    console.log(
      `[chat] MAS response: status=${upstream.status} hasBody=${!!upstream.body}`,
    );

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => '');
      console.error(`[chat] MAS error ${upstream.status}: ${errText.slice(0, 300)}`);
      send({ type: 'error', message: `MAS endpoint ${upstream.status}: ${errText.slice(0, 500)}` });
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      // SSE chunks are delimited by blank lines; each line starts with "data: "
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;
        if (payload === '[DONE]') continue;

        let chunk: unknown;
        try {
          chunk = JSON.parse(payload);
        } catch {
          continue;
        }

        const classified = classifyChunk(chunk);

        switch (classified.kind) {
          case 'text-delta': {
            const clean = stripNameArtifacts(classified.text);
            if (clean) {
              textBuf += clean;
              send({ type: 'text-delta', delta: clean });
            }
            break;
          }
          case 'tool-call': {
            toolName = classified.toolName;
            toolCallId = classified.callId;
            const label = resolveSpaceLabel(spaces, null, toolName);
            send({
              type: 'tool-call',
              toolCallId: classified.callId,
              toolName: classified.toolName,
              label,
            });
            break;
          }
          case 'tool-result': {
            if (toolCallId && classified.callId === toolCallId) {
              toolResultText = classified.text;
            }
            // Try to extract Genie routing IDs from the raw chunk (today: null)
            const maybeMeta = extractGenieMeta(chunk);
            if (maybeMeta) {
              genieMeta = maybeMeta;
              const label = resolveSpaceLabel(spaces, maybeMeta.genie_space_id, toolName);
              send({
                type: 'data-genie-meta',
                data: { ...maybeMeta, space_label: label },
              });
            }
            send({
              type: 'tool-result',
              toolCallId: classified.callId,
              toolName: toolName ?? null,
            });
            break;
          }
          case 'name-artifact':
            // Drop — internal MAS noise, do not forward
            break;
          case 'message-final':
            // The full message is delivered via text-delta chunks already; ignore the
            // duplicate final message.done event for forwarding, but track for fallback
            if (!textBuf) {
              textBuf = stripNameArtifacts(classified.text);
            }
            break;
          case 'unknown':
            // Unrecognized chunk - skip silently. Could log in dev.
            break;
        }
      }
    }

    // Persist assistant message
    const assembled: UIMessagePart[] = textBuf ? [{ type: 'text', text: textBuf }] : [];

    await appendMessage(chatId, {
      role: 'assistant',
      parts: assembled,
      genieSpaceId: genieMeta?.genie_space_id ?? toolNameToSpaceId(spaces, toolName) ?? undefined,
      genieConversationId: genieMeta?.genie_conversation_id ?? undefined,
      genieMessageId: genieMeta?.genie_message_id ?? undefined,
      toolName: toolName ?? undefined,
      // Tool result text often contains a markdown table for Genie answers; preserve as resultData if parseable
      ...(toolResultText
        ? { resultData: tryParseMarkdownTable(toolResultText) ?? undefined }
        : {}),
    });

    send({ type: 'finish' });
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error(`[chat] caught error:`, err);
    send({ type: 'error', message: (err as Error).message });
    res.end();
  }
});

/**
 * Maps MAS tool name (e.g. "lce-sales-txn-genie") to a Genie space_id using config.
 * Returns null if no mapping found.
 */
function toolNameToSpaceId(spaces: SpaceConfig[], toolName: string | null): string | null {
  if (!toolName) return null;
  const s = spaces.find((sp) => sp.tool_name === toolName);
  return s?.space_id ?? null;
}

/**
 * Best-effort parse of the Genie tool-result text as a pipe-table markdown table.
 * Returns null if the text doesn't look like a table. Skips empty cells from leading/trailing pipes.
 */
function tryParseMarkdownTable(text: string): { columns: string[]; rows: unknown[][] } | null {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const headerLine = lines[0]!;
  const separatorLine = lines[1]!;
  if (!/^\|?(\s*[-:]+\s*\|)+\s*[-:]*\s*\|?$/.test(separatorLine)) return null;
  const parseRow = (line: string) =>
    line
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim());
  const columns = parseRow(headerLine);
  const rows = lines.slice(2).map(parseRow);
  return { columns, rows };
}
