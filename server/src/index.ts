import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import authPlugin from './plugins/auth.js';
import { runMigrations } from './db/migrate.js';

// Route imports
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import categoryRoutes from './routes/categories.js';
import expenseRoutes from './routes/expenses.js';
import paymentRoutes from './routes/payments.js';
import dashboardRoutes from './routes/dashboard.js';
import avatarRoutes from './routes/avatar.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildServer() {
  const isTest = config.nodeEnv === 'test';
  // Default to 'warn' to silence routine INFO logs (200 OK, request completed), while preserving WARN (40), ERROR (50), FATAL (60)
  const logLevel = process.env.LOG_LEVEL || (config.nodeEnv === 'development' ? 'info' : 'warn');

  const fastify = Fastify({
    logger: isTest
      ? false
      : {
          level: logLevel,
          base: {
            env: config.nodeEnv,
          },
        },
    trustProxy: true,
  });

  // ── 1. Silence probe & static asset noise ──────────────────────────────────
  // Silences /health probes from Kubernetes and static file assets
  fastify.addHook('onRequest', async (req) => {
    const url = req.raw.url || '';
    if (
      url === '/health' ||
      url.startsWith('/health') ||
      url.startsWith('/assets') ||
      url.endsWith('.js') ||
      url.endsWith('.css') ||
      url.endsWith('.ico') ||
      url.endsWith('.png') ||
      url.endsWith('.svg') ||
      url.endsWith('.webp') ||
      url.endsWith('.jpg') ||
      url.endsWith('.jpeg') ||
      url.endsWith('.woff') ||
      url.endsWith('.woff2') ||
      url.endsWith('.map')
    ) {
      req.log.level = 'silent';
    }
  });

  // ── 2. Plugins ────────────────────────────────────────────────────────────
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  await fastify.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  });

  await fastify.register(authPlugin);

  // ── 3. API Routes ─────────────────────────────────────────────────────────
  await fastify.register(authRoutes);
  await fastify.register(userRoutes);
  await fastify.register(categoryRoutes);
  await fastify.register(expenseRoutes);
  await fastify.register(paymentRoutes);
  await fastify.register(dashboardRoutes);
  await fastify.register(avatarRoutes);

  // ── 4. Health Check (logLevel: 'silent' completely stops Kubernetes probe logs) ──
  fastify.get('/health', { logLevel: 'silent' }, async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  // ── 5. Static Assets & SPA Client-Side Routing ─────────────────────────────
  // Look for built frontend assets in dist/ directory (both local & container layout)
  const candidates = [
    path.resolve(__dirname, '../../dist'),
    path.resolve(__dirname, '../dist'),
    path.resolve(process.cwd(), 'dist'),
  ];
  const distPath = candidates.find((dir) => fs.existsSync(dir));

  if (distPath) {
    await fastify.register(fastifyStatic, {
      root: distPath,
      prefix: '/',
      wildcard: false, // Let custom notFoundHandler handle SPA client-side routes
    });

    fastify.setNotFoundHandler(async (req, reply) => {
      const url = req.raw.url || '';

      // If request was intended for an API route, return 404 JSON
      const isApiRoute =
        url.startsWith('/auth') ||
        url.startsWith('/users') ||
        url.startsWith('/categories') ||
        url.startsWith('/expenses') ||
        url.startsWith('/payments') ||
        url.startsWith('/dashboard') ||
        url.startsWith('/health') ||
        url.startsWith('/avatars') ||
        url.startsWith('/api');

      if (isApiRoute) {
        return reply.status(404).send({ error: 'Not Found', message: 'API route not found' });
      }

      // Otherwise, serve React index.html for client-side routing
      return reply.sendFile('index.html');
    });
  }

  return fastify;
}

async function start() {
  const logLevel = process.env.LOG_LEVEL || (config.nodeEnv === 'development' ? 'info' : 'warn');
  console.log(`[server] ==========================================`);
  console.log(`[server] App:          SplitTrack`);
  console.log(`[server] Environment:  ${config.nodeEnv.toUpperCase()}`);
  console.log(`[server] Log Level:    ${logLevel.toUpperCase()}`);
  console.log(`[server] Database:     ${config.database.host}:${config.database.port}/${config.database.name}`);
  console.log(`[server] ==========================================`);

  // Run migrations on startup
  try {
    await runMigrations();
  } catch (err) {
    console.error('[server] Migration failed:', err);
    process.exit(1);
  }

  const server = await buildServer();

  try {
    await server.listen({ port: config.port, host: config.host });
    console.log(`[server] SplitTrack running at http://${config.host}:${config.port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Only start if this is the main module (not imported for testing)
const isMainModule = process.argv[1]?.includes('index');
if (isMainModule || process.env.NODE_ENV !== 'test') {
  start();
}