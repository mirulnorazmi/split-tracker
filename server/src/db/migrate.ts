import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = fs.existsSync(path.resolve(__dirname, '../../db/migrations'))
  ? path.resolve(__dirname, '../../db/migrations')
  : path.resolve(__dirname, 'migrations');

/**
 * Runs all .sql migration files in lexicographic order.
 * Tracks applied migrations in a `_migrations` table.
 */
export async function runMigrations(): Promise<void> {
  // Ensure migrations tracking table exists
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await query('SELECT 1 FROM _migrations WHERE name = $1', [file]);
    if (rows.length > 0) {
      console.log(`[migrate] Skipping already applied: ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    console.log(`[migrate] Applying: ${file}`);

    await query(sql);
    await query('INSERT INTO _migrations (name) VALUES ($1)', [file]);

    console.log(`[migrate] Applied: ${file}`);
  }

  console.log('[migrate] All migrations applied.');
}

const isMainModule = process.argv[1]?.includes('migrate');
if (isMainModule) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[migrate] Error:', err);
      process.exit(1);
    });
}