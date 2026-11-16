import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { hashRegistrationToken } from './registration-token-store.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const expirationArgument = process.argv.find((argument) => argument.startsWith('--expires-hours='));
const expiresInHours = Number(expirationArgument?.split('=')[1] ?? '72');
if (!Number.isFinite(expiresInHours) || expiresInHours < 1 || expiresInHours > 720) {
  throw new Error('--expires-hours must be between 1 and 720');
}

const token = randomBytes(32).toString('base64url');
const pool = new Pool({ connectionString: databaseUrl });
const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

try {
  await pool.query(
    'INSERT INTO registration_tokens (id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [randomUUID(), hashRegistrationToken(token), expiresAt],
  );
  console.log(JSON.stringify({ registrationToken: token, expiresAt: expiresAt.toISOString() }));
} finally {
  await pool.end();
}
