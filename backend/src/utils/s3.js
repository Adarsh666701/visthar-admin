import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';

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

    await s3.send(new PutObjectCommand({
      Bucket: env.s3Bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        originalName: file.originalname || '',
      },
    }));

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
