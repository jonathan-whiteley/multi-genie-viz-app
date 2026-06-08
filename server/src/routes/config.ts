import { Router } from 'express';
import type { AppConfig, SpaceConfig } from '@multi-genie/core';

export const configRouter = Router();

configRouter.get('/api/config', (_req, res) => {
  const raw = process.env.GENIE_SPACES_JSON ?? '[]';
  let spaces: SpaceConfig[] = [];
  try {
    spaces = JSON.parse(raw);
  } catch (e) {
    res.status(500).json({ error: `GENIE_SPACES_JSON parse error: ${(e as Error).message}` });
    return;
  }
  const cfg: AppConfig = { spaces };
  res.json(cfg);
});
