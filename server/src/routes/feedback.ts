import { Router } from 'express';
import { z } from 'zod';
import {
  getMessage,
  upsertFeedback,
  clearFeedback,
  markFeedbackSynced,
  markFeedbackError,
  getFeedbackForMessage,
} from '@multi-genie/db';
import { submitGenieFeedback } from '../lib/genieFeedback.js';

export const feedbackRouter = Router();

const postSchema = z.object({
  rating: z.enum(['up', 'down']),
  comment: z.string().max(2000).optional(),
});

feedbackRouter.post('/api/messages/:id/feedback', async (req, res) => {
  const messageId = req.params.id!;
  const { rating, comment } = postSchema.parse(req.body);

  const msg = await getMessage(messageId);
  if (!msg) {
    res.status(404).json({ error: 'message not found' });
    return;
  }

  // Always persist locally first.
  const fb = await upsertFeedback({
    messageId,
    userId: req.userId!,
    rating,
    comment,
  });

  // Genie monitoring sync requires ALL THREE IDs. If any are missing, save locally and return
  // ok with syncedToGenie=false. The common case today (MAS doesn't surface conversation_id /
  // message_id) takes this branch.
  if (!msg.genieSpaceId || !msg.genieConversationId || !msg.genieMessageId) {
    const reason = 'awaiting MAS upstream update for Genie conversation/message IDs';
    await markFeedbackError(fb.id, reason);
    res.json({ ok: true, syncedToGenie: false, syncError: reason });
    return;
  }

  // Full sync path (lights up automatically when MAS is updated).
  const sync = await submitGenieFeedback({
    host: process.env.DATABRICKS_HOST!,
    accessToken: req.session!.accessToken,
    spaceId: msg.genieSpaceId,
    conversationId: msg.genieConversationId,
    messageId: msg.genieMessageId,
    rating,
    comment,
    pathOverride: process.env.GENIE_FEEDBACK_PATH,
  });

  if (sync.ok) {
    await markFeedbackSynced(fb.id);
    res.json({ ok: true, syncedToGenie: true });
  } else {
    await markFeedbackError(fb.id, sync.error);
    res.json({ ok: true, syncedToGenie: false, syncError: sync.error });
  }
});

feedbackRouter.get('/api/messages/:id/feedback', async (req, res) => {
  const fb = await getFeedbackForMessage(req.params.id!, req.userId!);
  res.json(fb ?? null);
});

feedbackRouter.delete('/api/messages/:id/feedback', async (req, res) => {
  await clearFeedback(req.params.id!, req.userId!);
  res.status(204).end();
});
