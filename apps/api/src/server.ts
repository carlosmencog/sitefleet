import { buildApp } from './app.js';
import { Pool } from 'pg';
import { PostgresAgentStore } from './repository.js';

const registrationToken = process.env.SITEFLEET_REGISTRATION_TOKEN;
const databaseUrl = process.env.DATABASE_URL;
const encryptionKey = process.env.SITEFLEET_ENCRYPTION_KEY;
if (!registrationToken || !databaseUrl || !encryptionKey) throw new Error('SITEFLEET_REGISTRATION_TOKEN, DATABASE_URL and SITEFLEET_ENCRYPTION_KEY are required');
const pool = new Pool({ connectionString: databaseUrl });
const app = buildApp({ registrationToken, store: new PostgresAgentStore(pool, Buffer.from(encryptionKey, 'base64')) });
const port = Number(process.env.PORT ?? 3001);

app.addHook('onClose', async () => pool.end());
await app.listen({ port, host: '0.0.0.0' });
