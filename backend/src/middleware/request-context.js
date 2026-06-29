import crypto from 'crypto';
import { env } from '../config/env.js';
import { log, redact } from '../utils/logger.js';

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
    originalUrl: req.originalUrl,
    query: req.query,
    ip,
    userAgent: req.header('user-agent'),
    contentType: req.header('content-type'),
    contentLength: req.header('content-length'),
  });

  if (env.logRequestBody && req.body && Object.keys(req.body).length) {
    log('debug', 'request.body', {
      requestId,
      method: req.method,
      path: req.path,
      body: redact(req.body),
    });
  }

  res.on('finish', () => {
    const latencyMs = Date.now() - startedAt;
    log('info', 'request.end', {
      requestId,
      method: req.method,
      path: req.path,
      ip,
      status: res.statusCode,
      latencyMs,
      responseContentLength: res.getHeader('content-length'),
    });
  });

  next();
}
