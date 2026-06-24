import bcrypt from 'bcryptjs';
import express from 'express';
import { getDb } from '../db/mongo.js';
import { isAllowedAdminDomain, requireAdmin, signAdminToken } from '../middleware/auth.js';
import { fail, ok } from '../utils/response.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const password = String(req.body?.password || '');

  if (!email || !password) return fail(res, 'email and password required', 400);
  if (!isAllowedAdminDomain(email)) return fail(res, 'only visthar admin domain is allowed', 403);

  const db = await getDb();
  const user = await db.collection('users').findOne({ email });
  if (!user || user.role !== 'admin') return fail(res, 'invalid credentials', 401);

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return fail(res, 'invalid credentials', 401);

  const safe = { id: user.id, email: user.email, name: user.name, role: user.role };
  const token = signAdminToken(safe);

  res.cookie('admin_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  });

  return ok(res, { ok: true, user: safe, token });
});

router.post('/logout', async (_req, res) => {
  res.cookie('admin_token', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 0,
    path: '/',
  });
  return ok(res, { ok: true });
});

router.get('/me', requireAdmin, async (req, res) => {
  return ok(res, { user: req.user });
});

export default router;
