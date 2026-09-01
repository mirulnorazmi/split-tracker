import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Client } from 'minio';
import { config } from '../config.js';
import { query } from '../db/pool.js';

const minioClient = new Client({
  endPoint: config.minio.endpoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

const BUCKET = config.minio.bucket;
const PUBLIC_URL = config.minio.publicUrl;

// Ensure bucket exists and has public read access on startup
async function ensureBucket() {
  try {
    const exists = await minioClient.bucketExists(BUCKET);
    if (!exists) {
      await minioClient.makeBucket(BUCKET, 'us-east-1');
      console.log(`[minio] Created bucket: ${BUCKET}`);
    } else {
      console.log(`[minio] Bucket "${BUCKET}" is ready.`);
    }

    // Set public read-only policy for bucket objects
    const readOnlyPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${BUCKET}/*`],
        },
      ],
    };

    try {
      await minioClient.setBucketPolicy(BUCKET, JSON.stringify(readOnlyPolicy));
      console.log(`[minio] Set public read policy for "${BUCKET}"`);
    } catch (policyErr) {
      console.warn(`[minio] Could not set bucket policy automatically:`, (policyErr as Error).message);
    }
  } catch (err) {
    console.warn(`[minio] Warning: Could not connect to object storage (${BUCKET}):`, (err as Error).message);
  }
}

export default async function avatarRoutes(fastify: FastifyInstance) {
  ensureBucket().catch((err) => console.warn('[minio] Bucket check error:', err.message));

  /**
   * POST /users/avatar
   * Authenticated — upload a profile avatar image
   * Accepts multipart/form-data with field name "avatar"
   */
  fastify.post('/users/avatar', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: userId } = request.user as { id: string };

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'Bad Request', message: 'No file uploaded' });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(data.mimetype)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'File must be JPEG, PNG, WebP, or GIF' });
    }

    // Max 5MB
    const maxSize = 5 * 1024 * 1024;
    const chunks: Buffer[] = [];
    let totalSize = 0;

    for await (const chunk of data.file) {
      totalSize += chunk.length;
      if (totalSize > maxSize) {
        return reply.status(400).send({ error: 'Bad Request', message: 'File too large (max 5MB)' });
      }
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    const ext = data.mimetype.split('/')[1] === 'jpeg' ? 'jpg' : data.mimetype.split('/')[1];
    const timestamp = Date.now();
    const objectName = `avatars/${userId}_${timestamp}.${ext}`;

    await minioClient.putObject(BUCKET, objectName, buffer, buffer.length, {
      'Content-Type': data.mimetype,
    });

    const avatarUrl = `${PUBLIC_URL}/${objectName}`;

    await query(
      `UPDATE "user" SET avatar = $1, updated_at = NOW() WHERE id = $2`,
      [avatarUrl, userId]
    );

    return reply.send({ avatar: avatarUrl, message: 'Avatar uploaded successfully.' });
  });

  /**
   * GET /avatars/*
   * Public — stream avatar object from storage with cache headers
   */
  fastify.get('/avatars/*', async (request: FastifyRequest, reply: FastifyReply) => {
    const objectPath = (request.params as Record<string, string>)['*'];
    if (!objectPath) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Avatar path required' });
    }

    try {
      const fullObjectName = objectPath.startsWith('avatars/') ? objectPath : `avatars/${objectPath}`;
      const stat = await minioClient.statObject(BUCKET, fullObjectName);
      const stream = await minioClient.getObject(BUCKET, fullObjectName);

      reply.header('Content-Type', stat.metaData?.['content-type'] || 'image/jpeg');
      reply.header('Cache-Control', 'public, max-age=86400');
      return reply.send(stream);
    } catch {
      return reply.status(404).send({ error: 'Not Found', message: 'Avatar image not found' });
    }
  });
}