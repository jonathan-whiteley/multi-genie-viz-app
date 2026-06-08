import express from 'express';
import 'dotenv/config';
import { authMiddleware } from './middleware/auth.js';
import { configRouter } from './routes/config.js';
import { historyRouter } from './routes/history.js';
import { chatRouter } from './routes/chat.js';
import { feedbackRouter } from './routes/feedback.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: '4mb' }));
app.use(authMiddleware);

app.use(configRouter);
app.use(historyRouter);
app.use(chatRouter);
app.use(feedbackRouter);

// Serve client build in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const port = Number(process.env.PORT ?? 8000);
app.listen(port, () => {
  console.log(`server listening on :${port}`);
});
