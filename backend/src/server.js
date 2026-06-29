import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { getDb } from './db/mongo.js';
import { requestContext } from './middleware/request-context.js';
import adminRoutes from './routes/admin-routes.js';
import authRoutes from './routes/auth-routes.js';
import { log, logError } from './utils/logger.js';

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
  logError('request.error', err, {
    requestId: req.ctx?.requestId,
    method: req.method,
    path: req.path,
  });
  res.status(500).json({ error: 'internal server error' });
});

process.on('unhandledRejection', (reason) => {
  logError('process.unhandled_rejection', reason instanceof Error ? reason : new Error(String(reason)));
});

process.on('uncaughtException', (error) => {
  logError('process.uncaught_exception', error);
  process.exit(1);
});

async function start() {
  await getDb();
  app.listen(env.port, () => {
    log('info', 'server.started', { port: env.port, db: env.dbName });
  });
}

start().catch((error) => {
  logError('server.failed', error);
  process.exit(1);
});
