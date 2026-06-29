import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4100),
  mongoUrl: process.env.MONGO_URL || 'mongodb://localhost:27017',
  dbName: process.env.DB_NAME || 'visthar',
  jwtSecret: process.env.JWT_SECRET || 'replace-this-secret',
  adminEmail: (process.env.ADMIN_EMAIL || 'admin@visthar-lifestyle.com').toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || 'ChangeMe@123',
  adminAllowedDomain: (process.env.ADMIN_ALLOWED_DOMAIN || '@visthar-lifestyle.com').toLowerCase(),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  awsRegion: process.env.AWS_REGION || 'ap-south-1',
  s3Bucket: process.env.S3_BUCKET || '',
  s3PublicBaseUrl: (process.env.S3_PUBLIC_BASE_URL || '').replace(/\/$/, ''),
  logLevel: (process.env.LOG_LEVEL || 'debug').toLowerCase(),
  logRequestBody: process.env.LOG_REQUEST_BODY === 'true',
};
