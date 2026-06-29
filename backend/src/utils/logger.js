import { env } from '../config/env.js';

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const REDACT_KEYS = new Set([
  'authorization',
  'cookie',
  'password',
  'password_hash',
  'token',
  'admin_token',
  'jwt',
  'jwtSecret',
  'secret',
  'accessKeyId',
  'secretAccessKey',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
]);

function shouldLog(level) {
  const configured = LEVELS[env.logLevel] ?? LEVELS.info;
  return (LEVELS[level] ?? LEVELS.info) >= configured;
}

export function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (REDACT_KEYS.has(key) || /password|token|secret|authorization|cookie/i.test(key)) {
      return [key, '[redacted]'];
    }
    return [key, redact(item)];
  }));
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({
      ts: new Date().toISOString(),
      level: 'error',
      event: 'logger.serialize_failed',
    });
  }
}

export function log(level, event, payload = {}) {
  if (!shouldLog(level)) return;

  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    ...redact(payload),
  };
  console.log(safeJson(line));
}

export function logError(event, error, payload = {}) {
  log('error', event, {
    ...payload,
    message: error?.message || 'Unknown error',
    stack: error?.stack,
    name: error?.name,
  });
}
