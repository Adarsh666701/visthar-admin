import crypto from 'crypto';
import { log } from '../utils/logger.js';

export function requestContext(req, res, next) {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  const startedAt = Date.now();
  const ip = (req.header('x-forwarded-for') || req.ip || 'unknown').split(',')[0].trim();

  req.ctx = {
    requestId,
    startedAt,
    ip,
  };

  res.setHeader('x-request-id', requestId);

  const originalWriteHead = res.writeHead.bind(res);
  res.writeHead = (...args) => {
    const latencyMs = Date.now() - startedAt;
    if (!res.headersSent) {
      res.setHeader('server-timing', `app;dur=${latencyMs}`);
    }
    return originalWriteHead(...args);
  };

  log('info', 'request.start', {
    requestId,
    method: req.method,
    path: req.path,
    ip,
  });

  res.on('finish', () => {
    const latencyMs = Date.now() - startedAt;
    log('info', 'request.end', {
      requestId,
      method: req.method,
      path: req.path,
      ip,
      status: res.statusCode,
      latencyMs,
    });
  });

  next();
}
