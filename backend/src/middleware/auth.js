import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { getDb } from '../db/mongo.js';
import { fail } from '../utils/response.js';

export function isAllowedAdminDomain(email) {
  return email.toLowerCase().endsWith(env.adminAllowedDomain);
}

export async function requireAdmin(req, res, next) {
  const token = req.cookies?.admin_token || (req.header('authorization') || '').replace(/^Bearer\s+/, '');
  if (!token) return fail(res, 'unauthenticated', 401);

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const db = await getDb();
    const user = await db.collection('users').findOne({ id: payload.sub });

    if (!user || user.role !== 'admin' || !isAllowedAdminDomain(user.email)) {
      return fail(res, 'forbidden', 403);
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    next();
  } catch {
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
