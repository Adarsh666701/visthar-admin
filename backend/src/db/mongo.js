import bcrypt from 'bcryptjs';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';

let cached = global.__vistharAdminDb;
if (!cached) {
  cached = global.__vistharAdminDb = {
    client: null,
    db: null,
    seeded: false,
    initialized: false,
  };
}

async function ensureIndexes(db) {
  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('users').createIndex({ createdAt: -1 }),
    db.collection('orders').createIndex({ createdAt: -1 }),
    db.collection('inventory').createIndex({ sku: 1 }, { unique: true }),
    db.collection('inventory').createIndex({ slug: 1 }, { unique: true }),
    db.collection('inventory').createIndex({ updatedAt: -1 }),
    db.collection('site_settings').createIndex({ key: 1 }, { unique: true }),
  ]);
}

async function seedAdmin(db) {
  const email = env.adminEmail;
  const hash = await bcrypt.hash(env.adminPassword, 10);
  const existing = await db.collection('users').findOne({ email });

  if (!existing) {
    await db.collection('users').insertOne({
      id: uuidv4(),
      email,
      password_hash: hash,
      name: 'Admin',
      role: 'admin',
      createdAt: new Date().toISOString(),
    });
    return;
  }

  if (existing.role !== 'admin') {
    await db.collection('users').updateOne({ email }, { $set: { role: 'admin', password_hash: hash } });
  }
}

export async function getDb() {
  if (cached.db) return cached.db;

  const client = new MongoClient(env.mongoUrl);
  await client.connect();
  cached.client = client;
  cached.db = client.db(env.dbName);

  if (!cached.initialized) {
    await ensureIndexes(cached.db);
    cached.initialized = true;
  }

  if (!cached.seeded) {
    await seedAdmin(cached.db);
    cached.seeded = true;
  }

  return cached.db;
}
