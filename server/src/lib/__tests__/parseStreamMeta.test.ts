import { describe, it, expect } from 'vitest';
import {
  classifyChunk,
  extractGenieMeta,
  resolveSpaceLabel,
  stripNameArtifacts,
} from '../parseStreamMeta.js';
import type { SpaceConfig } from '@multi-genie/core';

const spaces: SpaceConfig[] = [
  {
    space_id: '01f0aae3f2a812ceb9f489fa0317532a',
    label: 'LCE Sales TXN',
    tags: ['sales', 'revenue'],
    tool_name: 'lce-sales-txn-genie',
    suggested_questions: [],
  },
  {
    space_id: '01f0fd65f875113b9e1c5ec160aa65bf',
    label: 'Finance',
    tags: ['finance'],
    tool_name: 'finance-genie',
    suggested_questions: [],
  },
];

describe('classifyChunk', () => {
  it('classifies text-delta', () => {
    const c = classifyChunk({
      type: 'response.output_text.delta',
      custom_outputs: null,
      item_id: 'msg_x', delta: 'Q1 revenues', step: 2, id: 'resp_x',
    });
    expect(c).toEqual({ kind: 'text-delta', text: 'Q1 revenues', step: 2 });
  });

  it('classifies tool-call (function_call output_item.done)', () => {
    const c = classifyChunk({
      type: 'response.output_item.done', custom_outputs: null,
      item: {
        type: 'function_call', id: 'msg_x',
        call_id: 'toolu_x', name: 'lce-sales-txn-genie',
        arguments: '{"genie_query":"q"}', step: 1,
      },
      id: 'resp_x',
    });
    expect(c).toEqual({
      kind: 'tool-call',
      callId: 'toolu_x',
      toolName: 'lce-sales-txn-genie',
      argumentsRaw: '{"genie_query":"q"}',
      step: 1,
    });
  });

  it('classifies tool-result (message with matching call_id)', () => {
    const c = classifyChunk({
      type: 'response.output_item.done', custom_outputs: null,
      item: {
        type: 'message', id: 'msg_y', role: 'assistant',
        content: [{ type: 'output_text', text: '||total_net_sales_usd|\n|-|-|\n|0|1172180.16|' }],
        call_id: 'toolu_x',
      },
      id: 'resp_x',
    });
    expect(c).toEqual({
      kind: 'tool-result',
      callId: 'toolu_x',
      text: '||total_net_sales_usd|\n|-|-|\n|0|1172180.16|',
    });
  });

  it('classifies name-artifact (message containing only <name>X</name>)', () => {
    const c = classifyChunk({
      type: 'response.output_item.done', custom_outputs: null,
      item: {
        type: 'message', id: 'x', role: 'assistant',
        content: [{ type: 'output_text', text: '<name>lce-sales-txn-genie</name>' }],
      },
      id: 'resp_x',
    });
    expect(c).toEqual({ kind: 'name-artifact', toolName: 'lce-sales-txn-genie' });
  });

  it('classifies final assistant message', () => {
    const c = classifyChunk({
      type: 'response.output_item.done', custom_outputs: null,
      item: {
        type: 'message', id: 'msg_z', role: 'assistant',
        content: [{ type: 'output_text', text: 'Q1 revenues were $1.17M.' }],
      },
      step: 2,
      id: 'resp_x',
    });
    expect(c).toEqual({ kind: 'message-final', text: 'Q1 revenues were $1.17M.', step: 2 });
  });

  it('returns unknown for unrecognized chunks', () => {
    const c = classifyChunk({ type: 'response.unknown.event', foo: 'bar' });
    expect(c.kind).toBe('unknown');
  });
});

describe('extractGenieMeta', () => {
  it('returns null when fields absent (today\'s MAS case)', () => {
    expect(extractGenieMeta({ custom_outputs: null, item: { type: 'message' } })).toBeNull();
  });

  it('returns ids when present in custom_outputs (future MAS case)', () => {
    const r = extractGenieMeta({
      custom_outputs: {
        genie_space_id: 'sp1',
        genie_conversation_id: 'c1',
        genie_message_id: 'm1',
      },
    });
    expect(r).toEqual({
      genie_space_id: 'sp1',
      genie_conversation_id: 'c1',
      genie_message_id: 'm1',
    });
  });

  it('returns ids when deeply nested', () => {
    const r = extractGenieMeta({
      item: { metadata: { genie_space_id: 'sp2', genie_conversation_id: 'c2', genie_message_id: 'm2' } },
    });
    expect(r?.genie_space_id).toBe('sp2');
  });

  it('returns null if any one id is missing', () => {
    expect(extractGenieMeta({ custom_outputs: { genie_space_id: 's', genie_conversation_id: 'c' } })).toBeNull();
  });
});

describe('resolveSpaceLabel', () => {
  it('matches by space_id first', () => {
    expect(resolveSpaceLabel(spaces, '01f0aae3f2a812ceb9f489fa0317532a', null)).toBe('LCE Sales TXN');
  });

  it('falls back to tool_name when no space_id', () => {
    expect(resolveSpaceLabel(spaces, null, 'finance-genie')).toBe('Finance');
  });

  it('returns "Genie" when no match', () => {
    expect(resolveSpaceLabel(spaces, null, 'unknown-genie')).toBe('Genie');
  });

  it('returns "Genie" when both null', () => {
    expect(resolveSpaceLabel(spaces, null, null)).toBe('Genie');
  });
});

describe('stripNameArtifacts', () => {
  it('removes <name>X</name> tags', () => {
    expect(stripNameArtifacts('hello <name>tool</name> world')).toBe('hello  world');
  });
  it('removes multiple tags', () => {
    expect(stripNameArtifacts('<name>a</name>x<name>b</name>')).toBe('x');
  });
  it('leaves text without tags unchanged', () => {
    expect(stripNameArtifacts('plain text')).toBe('plain text');
  });
});
