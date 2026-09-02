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
  const fastify = Fastify({
    logger:
      config.nodeEnv === 'test'
        ? false
        : {
            level: process.env.LOG_LEVEL || (config.nodeEnv === 'production' ? 'warn' : 'info'),
          },
    trustProxy: true,
  });

  // ── 1. Noise-Filter Hook: Silence log output for static assets ──────────────
  // Prevents terminal and container logs from being flooded with .js, .css, .png requests
  fastify.addHook('onRequest', async (req) => {
    const url = req.raw.url || '';
    if (
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

  // ── 4. Health Check ───────────────────────────────────────────────────────
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

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
  console.log(`[server] Initializing PostgreSQL connection to ${config.database.host}:${config.database.port}/${config.database.name}...`);

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