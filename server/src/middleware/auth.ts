import type { Request, Response, NextFunction } from 'express';
import { parseOboHeaders, type Session } from '@multi-genie/auth';
import { upsertUserByEmail } from '@multi-genie/db';

declare module 'express-serve-static-core' {
  interface Request {
    session?: Session;
    userId?: string;
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const session = parseOboHeaders(req.headers);
  if (!session) {
    // Local-dev fallback: if DEV_EMAIL is set and we're not in production, accept that.
    if (process.env.NODE_ENV !== 'production' && process.env.DEV_EMAIL) {
      const email = process.env.DEV_EMAIL;
      const u = await upsertUserByEmail(email);
      req.session = {
        email,
        username: email.split('@')[0] ?? email,
        accessToken: process.env.DATABRICKS_TOKEN ?? '',
      };
      req.userId = u.id;
      next();
      return;
    }
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }
  const u = await upsertUserByEmail(session.email);
  req.session = session;
  req.userId = u.id;
  next();
}
