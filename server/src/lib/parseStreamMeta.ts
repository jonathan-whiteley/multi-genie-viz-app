import type { SpaceConfig, GenieMeta } from '@multi-genie/core';

export type ClassifiedChunk =
  | { kind: 'text-delta'; text: string; step?: number }
  | { kind: 'tool-call'; callId: string; toolName: string; argumentsRaw: string; step?: number }
  | { kind: 'tool-result'; callId: string; text: string }
  | { kind: 'name-artifact'; toolName: string }
  | { kind: 'message-final'; text: string; step?: number }
  | { kind: 'unknown'; raw: unknown };

const NAME_TAG = /^<name>(.+?)<\/name>$/;

export function classifyChunk(chunk: unknown): ClassifiedChunk {
  if (!chunk || typeof chunk !== 'object') return { kind: 'unknown', raw: chunk };
  const c = chunk as Record<string, unknown>;

  if (c['type'] === 'response.output_text.delta') {
    return {
      kind: 'text-delta',
      text: String(c['delta'] ?? ''),
      ...(typeof c['step'] === 'number' ? { step: c['step'] } : {}),
    };
  }

  if (c['type'] === 'response.output_item.done' && c['item'] && typeof c['item'] === 'object') {
    const item = c['item'] as Record<string, unknown>;

    if (item['type'] === 'function_call') {
      return {
        kind: 'tool-call',
        callId: String(item['call_id'] ?? ''),
        toolName: String(item['name'] ?? ''),
        argumentsRaw: String(item['arguments'] ?? ''),
        ...(typeof item['step'] === 'number' ? { step: item['step'] } : {}),
      };
    }

    if (item['type'] === 'message') {
      const callId = typeof item['call_id'] === 'string' ? item['call_id'] : null;
      const text = extractMessageText(item);

      if (callId) {
        return { kind: 'tool-result', callId, text };
      }

      const nameMatch = NAME_TAG.exec(text.trim());
      if (nameMatch && nameMatch[1]) {
        return { kind: 'name-artifact', toolName: nameMatch[1] };
      }

      return {
        kind: 'message-final',
        text,
        ...(typeof c['step'] === 'number' ? { step: c['step'] } : {}),
      };
    }
  }

  return { kind: 'unknown', raw: chunk };
}

function extractMessageText(item: Record<string, unknown>): string {
  const content = item['content'];
  if (!Array.isArray(content)) return '';
  return content
    .filter(
      (p): p is { type: string; text: string } =>
        !!p &&
        typeof p === 'object' &&
        (p as Record<string, unknown>)['type'] === 'output_text' &&
        typeof (p as Record<string, unknown>)['text'] === 'string',
    )
    .map((p) => p.text)
    .join('');
}

function deepFind<T>(obj: unknown, keys: string[]): T | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    if (k in o && o[k] !== undefined && o[k] !== null) return o[k] as T;
  }
  for (const v of Object.values(o)) {
    if (v && typeof v === 'object') {
      const found = deepFind<T>(v, keys);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

export function extractGenieMeta(toolOutput: unknown): GenieMeta | null {
  const space_id = deepFind<string>(toolOutput, ['genie_space_id']);
  const conversation_id = deepFind<string>(toolOutput, ['genie_conversation_id']);
  const message_id = deepFind<string>(toolOutput, ['genie_message_id']);
  if (!space_id || !conversation_id || !message_id) return null;
  return {
    genie_space_id: space_id,
    genie_conversation_id: conversation_id,
    genie_message_id: message_id,
  };
}

export function resolveSpaceLabel(
  spaces: SpaceConfig[],
  spaceId: string | null,
  toolName: string | null,
): string {
  if (spaceId) {
    const bySpace = spaces.find((s) => s.space_id === spaceId);
    if (bySpace) return bySpace.label;
  }
  if (toolName) {
    const byTool = spaces.find((s) => s.tool_name === toolName);
    if (byTool) return byTool.label;
  }
  return 'Genie';
}

export function stripNameArtifacts(text: string): string {
  return text.replace(/<name>.*?<\/name>/g, '');
}
