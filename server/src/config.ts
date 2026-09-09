import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    name: process.env.DATABASE_NAME || 'splittrack',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'changeme',
    url: process.env.DATABASE_URL || 'postgresql://postgres:changeme@localhost:5432/splittrack',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // MinIO
  minio: (() => {
    const rawEndpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const cleanEndpoint = rawEndpoint.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    const isSSL = process.env.MINIO_USE_SSL === 'true' || rawEndpoint.startsWith('https://');
    const defaultPort = isSSL ? 443 : 9000;
    const port = parseInt(process.env.MINIO_PORT || String(defaultPort), 10);
    const bucket = process.env.MINIO_BUCKET || 'splittrack-avatars';
    const receiptBucket = process.env.MINIO_RECEIPT_BUCKET || 'og-bucket';
    const publicUrl = (process.env.MINIO_PUBLIC_URL || `${isSSL ? 'https' : 'http'}://${cleanEndpoint}:${port}/${bucket}`).replace(/^https?:\/\/https?:\/\//, 'https://');

    return {
      endpoint: cleanEndpoint,
      port,
      useSSL: isSSL,
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
      bucket,
      receiptBucket,
      publicUrl,
    };
  })(),
} as const;

export type Config = typeof config;