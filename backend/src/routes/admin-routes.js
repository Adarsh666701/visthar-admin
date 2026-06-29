import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/mongo.js';
import { requireAdmin } from '../middleware/auth.js';
import { uploadInventoryImages } from '../utils/s3.js';
import { log, logError } from '../utils/logger.js';
import { fail, ok } from '../utils/response.js';

const router = express.Router();
router.use(requireAdmin);

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseFeatures(value) {
  return String(value || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSpecs(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

const inventoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 6,
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith('image/')) {
      return cb(new Error('only image files are allowed'));
    }
    cb(null, true);
  },
});

const LIST_MAP = {
  prebookings: 'prebookings',
  notify: 'notify_me',
  newsletter: 'newsletter',
  contacts: 'contact_messages',
  oem: 'oem_leads',
  orders: 'orders',
  users: 'users',
};

router.get('/stats', async (_req, res) => {
  const db = await getDb();
  const [prebookings, notify, newsletter, contact, oem, users, orders, rev] = await Promise.all([
    db.collection('prebookings').countDocuments(),
    db.collection('notify_me').countDocuments(),
    db.collection('newsletter').countDocuments(),
    db.collection('contact_messages').countDocuments(),
    db.collection('oem_leads').countDocuments(),
    db.collection('users').countDocuments(),
    db.collection('orders').countDocuments(),
    db.collection('orders').aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]).toArray(),
  ]);

  return ok(res, {
    prebookings,
    notify,
    newsletter,
    contact,
    oem,
    users,
    orders,
    revenue: rev?.[0]?.total || 0,
  });
});

router.get('/list/:name', async (req, res) => {
  const colName = LIST_MAP[req.params.name];
  if (!colName) return fail(res, 'unknown list', 404);

  const limit = Math.min(Math.max(Number(req.query.limit || 200), 1), 500);
  const skip = Math.max(Number(req.query.skip || 0), 0);

  const db = await getDb();
  const items = await db.collection(colName)
    .find({}, { projection: { _id: 0, password_hash: 0 } })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return ok(res, { items, limit, skip });
});

router.get('/site-settings', async (_req, res) => {
  const db = await getDb();
  const settings = await db.collection('site_settings').findOne({ key: 'contact' }, { projection: { _id: 0 } });
  return ok(res, { settings: settings || {} });
});

router.put('/site-settings', async (req, res) => {
  const allowed = ['email', 'phone', 'address', 'hq', 'instagram', 'twitter', 'youtube', 'linkedin', 'company'];
  const update = {};
  for (const key of allowed) {
    if (req.body?.[key] !== undefined) update[key] = String(req.body[key]);
  }
  update.updatedAt = new Date().toISOString();

  const db = await getDb();
  await db.collection('site_settings').updateOne({ key: 'contact' }, { $set: update }, { upsert: true });
  return ok(res, { ok: true, settings: update });
});

router.get('/inventory', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 200), 1), 500);
  const skip = Math.max(Number(req.query.skip || 0), 0);

  const db = await getDb();
  const items = await db.collection('inventory')
    .find({}, { projection: { _id: 0 } })
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return ok(res, { items, limit, skip });
});

router.post('/inventory', inventoryUpload.array('images', 6), async (req, res) => {
  const requestId = req.ctx?.requestId;

  try {
    const sku = String(req.body?.sku || '').trim().toUpperCase();
    const name = String(req.body?.name || '').trim();
    const slug = slugify(req.body?.slug || name || sku);

    log('info', 'inventory.create.received', {
      requestId,
      sku,
      slug,
      name,
      imageCount: req.files?.length || 0,
      files: (req.files || []).map((file) => ({
        originalName: file.originalname,
        contentType: file.mimetype,
        size: file.size,
      })),
    });

    if (!sku || !name) return fail(res, 'sku and name required', 400);
    if (!slug) return fail(res, 'valid slug or name required', 400);

    const db = await getDb();
    const existing = await db.collection('inventory').findOne({ $or: [{ sku }, { slug }] });
    if (existing?.sku === sku) {
      log('warn', 'inventory.create.duplicate_sku', { requestId, sku, slug });
      return fail(res, 'sku already exists', 400);
    }
    if (existing?.slug === slug) {
      log('warn', 'inventory.create.duplicate_slug', { requestId, sku, slug });
      return fail(res, 'slug already exists', 400);
    }

    log('debug', 'inventory.create.uploading_images', { requestId, sku, slug, imageCount: req.files?.length || 0 });
    const images = await uploadInventoryImages(req.files || [], sku);
    const primaryImage = images[0]?.url || String(req.body?.image || '').trim();

    const item = {
      id: uuidv4(),
      sku,
      slug,
      name,
      category: String(req.body?.category || 'future-products').trim(),
      tagline: String(req.body?.tagline || req.body?.notes || '').trim(),
      badge: String(req.body?.badge || 'NEW').trim(),
      price: Number(req.body?.price || 0),
      stock: Number(req.body?.stock || 0),
      status: String(req.body?.status || 'active'),
      notes: String(req.body?.notes || ''),
      image: primaryImage,
      images,
      features: parseFeatures(req.body?.features),
      specs: parseSpecs(req.body?.specs),
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    await db.collection('inventory').insertOne(item);
    log('info', 'inventory.create.success', {
      requestId,
      id: item.id,
      sku,
      slug,
      imageCount: images.length,
      mongoCollection: 'inventory',
    });

    return ok(res, { ok: true, item }, 201);
  } catch (error) {
    logError('inventory.create.failed', error, { requestId });
    return fail(res, error?.message || 'inventory create failed', 500);
  }
});

router.put('/inventory/:id', async (req, res) => {
  const id = String(req.params.id || '');
  const update = {
    updatedAt: new Date().toISOString(),
  };

  const allowed = ['name', 'status', 'notes'];
  for (const key of allowed) {
    if (req.body?.[key] !== undefined) update[key] = String(req.body[key]);
  }
  if (req.body?.price !== undefined) update.price = Number(req.body.price || 0);
  if (req.body?.stock !== undefined) update.stock = Number(req.body.stock || 0);

  const db = await getDb();
  const result = await db.collection('inventory').updateOne({ id }, { $set: update });
  if (!result.matchedCount) return fail(res, 'inventory item not found', 404);

  const item = await db.collection('inventory').findOne({ id }, { projection: { _id: 0 } });
  log('info', 'inventory.update.success', {
    requestId: req.ctx?.requestId,
    id,
    updatedFields: Object.keys(update),
  });
  return ok(res, { ok: true, item });
});

router.delete('/inventory/:id', async (req, res) => {
  const id = String(req.params.id || '');
  const db = await getDb();
  const result = await db.collection('inventory').deleteOne({ id });
  if (!result.deletedCount) return fail(res, 'inventory item not found', 404);

  log('info', 'inventory.delete.success', {
    requestId: req.ctx?.requestId,
    id,
  });
  return ok(res, { ok: true });
});

router.use((err, req, res, _next) => {
  logError('admin.route.error', err, {
    requestId: req.ctx?.requestId,
    method: req.method,
    path: req.path,
  });
  return fail(res, err?.message || 'admin route failed', err instanceof multer.MulterError ? 400 : 500);
});

export default router;
