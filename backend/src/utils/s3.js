import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';
import { log, logError } from './logger.js';

const s3 = new S3Client({ region: env.awsRegion });

function safeFileName(name) {
  return String(name || 'image')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'image';
}

function publicUrlFor(key) {
  if (env.s3PublicBaseUrl) return `${env.s3PublicBaseUrl}/${key}`;

  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `https://${env.s3Bucket}.s3.${env.awsRegion}.amazonaws.com/${encodedKey}`;
}

export async function uploadInventoryImages(files = [], sku) {
  if (!files.length) return [];
  if (!env.s3Bucket) throw new Error('S3_BUCKET is required to upload inventory images');

  return Promise.all(files.map(async (file) => {
    const key = `inventory/${sku}/${Date.now()}-${uuidv4()}-${safeFileName(file.originalname)}`;

    log('info', 's3.upload.start', {
      sku,
      bucket: env.s3Bucket,
      key,
      contentType: file.mimetype,
      originalName: file.originalname,
      size: file.size,
    });

    try {
      await s3.send(new PutObjectCommand({
        Bucket: env.s3Bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          originalName: file.originalname || '',
        },
      }));
    } catch (error) {
      logError('s3.upload.failed', error, {
        sku,
        bucket: env.s3Bucket,
        key,
        contentType: file.mimetype,
        originalName: file.originalname,
        size: file.size,
      });
      throw error;
    }

    log('info', 's3.upload.success', {
      sku,
      bucket: env.s3Bucket,
      key,
      url: publicUrlFor(key),
    });

    return {
      url: publicUrlFor(key),
      key,
      bucket: env.s3Bucket,
      contentType: file.mimetype,
      originalName: file.originalname,
      size: file.size,
    };
  }));
}
