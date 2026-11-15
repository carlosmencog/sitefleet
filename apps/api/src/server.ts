import { buildApp } from './app.js';
import { Pool } from 'pg';
import { PostgresAgentStore } from './repository.js';
import { BullMqAlertQueue } from './alert-queue.js';

const registrationToken = process.env.SITEFLEET_REGISTRATION_TOKEN;
const databaseUrl = process.env.DATABASE_URL;
const encryptionKey = process.env.SITEFLEET_ENCRYPTION_KEY;
const redisUrl = process.env.REDIS_URL;
if (!registrationToken || !databaseUrl || !encryptionKey || !redisUrl) throw new Error('SITEFLEET_REGISTRATION_TOKEN, DATABASE_URL, SITEFLEET_ENCRYPTION_KEY and REDIS_URL are required');
const pool = new Pool({ connectionString: databaseUrl });
const alertQueue = new BullMqAlertQueue(redisUrl);
const app = buildApp({ registrationToken, store: new PostgresAgentStore(pool, Buffer.from(encryptionKey, 'base64')), alertQueue });
const port = Number(process.env.PORT ?? 3001);

app.addHook('onClose', async () => { await alertQueue.close(); await pool.end(); });
await app.listen({ port, host: '0.0.0.0' });
