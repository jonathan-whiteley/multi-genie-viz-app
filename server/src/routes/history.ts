import { Router } from 'express';
import { z } from 'zod';
import {
  listChats,
  createChat,
  getChat,
  deleteChat,
  listMessages,
} from '@multi-genie/db';

export const historyRouter = Router();

historyRouter.get('/api/chats', async (req, res) => {
  const chats = await listChats(req.userId!);
  res.json(chats);
});

historyRouter.post('/api/chats', async (req, res) => {
  const body = z.object({ title: z.string().optional() }).parse(req.body ?? {});
  const c = await createChat(req.userId!, body.title ?? null);
  res.status(201).json(c);
});

historyRouter.get('/api/chats/:id', async (req, res) => {
  const c = await getChat(req.params.id!, req.userId!);
  if (!c) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json(c);
});

historyRouter.get('/api/chats/:id/messages', async (req, res) => {
  const c = await getChat(req.params.id!, req.userId!);
  if (!c) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const msgs = await listMessages(req.params.id!);
  res.json(msgs);
});

historyRouter.delete('/api/chats/:id', async (req, res) => {
  await deleteChat(req.params.id!, req.userId!);
  res.status(204).end();
});
