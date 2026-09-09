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
import recurringRoutes from './routes/recurring.js';
import folderRoutes from './routes/folders.js';

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
    methods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  await fastify.register(multipart, {
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB (supports high-res receipt photos)
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
  await fastify.register(recurringRoutes);
  await fastify.register(folderRoutes);

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
      setHeaders: (res, pathName) => {
        if (pathName.includes('/assets/')) {
          // Versioned hashed assets (e.g. index-*.js, vendor-*.js, index-*.css)
          res.header('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (pathName.endsWith('.html')) {
          // HTML files revalidate so deployments update immediately
          res.header('Cache-Control', 'no-cache');
        } else {
          // Non-hashed static assets (e.g. logo.webp, images)
          res.header('Cache-Control', 'public, max-age=2592000');
        }
      },
    });

    // Intercept browser page navigation for client-side routes (e.g. /expenses, /payments, /users, /dashboard)
    // When a user refreshes or visits in a browser, the browser requests HTML.
    // Fastify must serve index.html instead of executing the backend JSON route!
    fastify.addHook('preHandler', async (req, reply) => {
      if (req.method !== 'GET') return;

      const url = req.raw.url?.split('?')[0] || '';
      const accept = req.headers.accept || '';
      const secFetchDest = req.headers['sec-fetch-dest'];

      // Never intercept static assets, health probes, avatar or receipt streaming
      if (
        url === '/health' ||
        url.startsWith('/health') ||
        url.startsWith('/avatars') ||
        url.startsWith('/receipts') ||
        url.startsWith('/assets') ||
        url.includes('.')
      ) {
        return;
      }

      // If browser is navigating to a page / refreshing in the browser
      const isBrowserNavigation =
        secFetchDest === 'document' ||
        (accept.includes('text/html') && !accept.includes('application/json'));

      if (isBrowserNavigation) {
        return reply.sendFile('index.html');
      }
    });

    fastify.setNotFoundHandler(async (req, reply) => {
      const acceptHeader = req.headers.accept || '';
      const secFetchDest = req.headers['sec-fetch-dest'];

      // If browser navigation / page refresh (client requests HTML), serve index.html for React Router
      if (req.method === 'GET' && (secFetchDest === 'document' || acceptHeader.includes('text/html') || !acceptHeader.includes('application/json'))) {
        return reply.sendFile('index.html');
      }

      // Otherwise, if API / AJAX request, return 404 JSON
      return reply.status(404).send({ error: 'Not Found', message: 'API route not found' });
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