import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { getDb } from './db/mongo.js';
import { requestContext } from './middleware/request-context.js';
import adminRoutes from './routes/admin-routes.js';
import authRoutes from './routes/auth-routes.js';
import { log } from './utils/logger.js';

const app = express();

app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(requestContext);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'visthar-admin-backend', ts: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, req, res, _next) => {
  log('error', 'request.error', {
    requestId: req.ctx?.requestId,
    message: err?.message || 'Unhandled error',
    stack: err?.stack,
  });
  res.status(500).json({ error: 'internal server error' });
});

async function start() {
  await getDb();
  app.listen(env.port, () => {
    log('info', 'server.started', { port: env.port, db: env.dbName });
  });
}

start().catch((error) => {
  log('error', 'server.failed', { message: error?.message, stack: error?.stack });
  process.exit(1);
});
