import type { StoredMessage, UIMessagePart } from '@multi-genie/core';
import { AssistantMessage } from './AssistantMessage.js';

function textOf(parts: UIMessagePart[]): string {
  return parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

export function Message(props: { message: StoredMessage; spaceLabel: string | null }) {
  if (props.message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[60%] rounded-2xl bg-[color:var(--color-ink)] px-4 py-2 text-sm text-white">
          {textOf(props.message.parts as UIMessagePart[])}
        </div>
      </div>
    );
  }
  return (
    <AssistantMessage
      messageId={props.message.id}
      text={textOf(props.message.parts as UIMessagePart[])}
      toolLabel={props.spaceLabel}
      sql={props.message.sqlQuery}
      rows={props.message.resultData}
      // Feedback always shown for assistant messages — the server gracefully degrades sync.
      showFeedback={true}
    />
  );
}
