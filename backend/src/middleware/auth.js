import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { getDb } from '../db/mongo.js';
import { log } from '../utils/logger.js';
import { fail } from '../utils/response.js';

export function isAllowedAdminDomain(email) {
  return email.toLowerCase().endsWith(env.adminAllowedDomain);
}

export async function requireAdmin(req, res, next) {
  const token = req.cookies?.admin_token || (req.header('authorization') || '').replace(/^Bearer\s+/, '');
  if (!token) {
    log('warn', 'auth.require_admin.missing_token', { requestId: req.ctx?.requestId, path: req.path });
    return fail(res, 'unauthenticated', 401);
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const db = await getDb();
    const user = await db.collection('users').findOne({ id: payload.sub });

    if (!user || user.role !== 'admin' || !isAllowedAdminDomain(user.email)) {
      log('warn', 'auth.require_admin.forbidden', {
        requestId: req.ctx?.requestId,
        path: req.path,
        userId: payload.sub,
        found: Boolean(user),
        role: user?.role,
        email: user?.email,
      });
      return fail(res, 'forbidden', 403);
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    log('debug', 'auth.require_admin.success', {
      requestId: req.ctx?.requestId,
      path: req.path,
      userId: user.id,
      email: user.email,
    });

    next();
  } catch {
    log('warn', 'auth.require_admin.invalid_token', { requestId: req.ctx?.requestId, path: req.path });
    return fail(res, 'unauthenticated', 401);
  }
}

export function signAdminToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: '12h' }
  );
}
