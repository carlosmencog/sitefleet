import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: databaseUrl });
const directory = join(fileURLToPath(new URL('.', import.meta.url)), '../db/migrations');
await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
for (const name of (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort()) {
  const alreadyApplied = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
  if (alreadyApplied.rowCount) continue;
  const client = await pool.connect();
  try { await client.query('BEGIN'); await client.query(await readFile(join(directory, name), 'utf8')); await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]); await client.query('COMMIT'); console.log(`Applied ${name}`); }
  catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
await pool.end();
