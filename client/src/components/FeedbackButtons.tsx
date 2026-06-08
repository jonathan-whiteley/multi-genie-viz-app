import { useEffect, useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import clsx from 'clsx';
import { fetchFeedback, submitFeedback, clearFeedback } from '../lib/api.js';

export function FeedbackButtons(props: { messageId: string; spaceLabel: string | null }) {
  const [rating, setRating] = useState<'up' | 'down' | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void fetchFeedback(props.messageId).then((fb) => fb && setRating(fb.rating));
  }, [props.messageId]);

  async function pick(next: 'up' | 'down') {
    if (rating === next) {
      await clearFeedback(props.messageId);
      setRating(null);
      return;
    }
    if (next === 'down') {
      setCommentOpen(true);
      setRating('down');
      return;
    }
    setRating('up');
    const res = await submitFeedback(props.messageId, 'up');
    setToast(
      res.syncedToGenie
        ? `Sent to ${props.spaceLabel ?? 'Genie'} monitoring`
        : 'Saved (Genie sync pending MAS update)',
    );
    setTimeout(() => setToast(null), 2500);
  }

  async function submitDown() {
    const res = await submitFeedback(props.messageId, 'down', comment.trim() || undefined);
    setCommentOpen(false);
    setComment('');
    setToast(
      res.syncedToGenie
        ? `Sent to ${props.spaceLabel ?? 'Genie'} monitoring`
        : 'Saved (Genie sync pending MAS update)',
    );
    setTimeout(() => setToast(null), 2500);
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        type="button"
        onClick={() => pick('up')}
        className={clsx(
          'rounded-md p-1.5 hover:bg-[color:var(--color-chip-bg)]',
          rating === 'up' && 'text-[color:var(--color-accent)]',
        )}
        aria-label="Helpful"
      >
        <ThumbsUp size={14} />
      </button>
      <button
        type="button"
        onClick={() => pick('down')}
        className={clsx(
          'rounded-md p-1.5 hover:bg-[color:var(--color-chip-bg)]',
          rating === 'down' && 'text-[color:var(--color-accent)]',
        )}
        aria-label="Not helpful"
      >
        <ThumbsDown size={14} />
      </button>
      {commentOpen && (
        <div className="flex flex-1 items-center gap-2">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="(Optional) What went wrong?"
            className="flex-1 rounded-md border border-[color:var(--color-card-border)] px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={() => void submitDown()}
            className="rounded-md bg-[color:var(--color-accent)] px-2 py-1 text-xs text-white"
          >
            Send
          </button>
        </div>
      )}
      {toast && <span className="text-xs text-[color:var(--color-ink-2)]">{toast}</span>}
    </div>
  );
}
