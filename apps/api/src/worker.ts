import { Worker } from 'bullmq';
import { Pool } from 'pg';
import { evaluateInventory, type Inventory } from './alert-rules.js';
import type { InventoryJob } from './alert-queue.js';

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
if (!databaseUrl || !redisUrl) throw new Error('DATABASE_URL and REDIS_URL are required');
const pool = new Pool({ connectionString: databaseUrl });
const worker = new Worker<InventoryJob>('inventory-alerts', async (job) => {
  const alerts = evaluateInventory(job.data.inventory as Inventory);
  for (const alert of alerts) {
    await pool.query("INSERT INTO alerts (agent_id, fingerprint, type, severity, details, first_seen_at, last_seen_at, occurrences) VALUES ($1, $2, $3, $4, $5::jsonb, now(), now(), 1) ON CONFLICT (agent_id, fingerprint) DO UPDATE SET severity = EXCLUDED.severity, details = EXCLUDED.details, last_seen_at = now(), occurrences = alerts.occurrences + 1", [job.data.agentId, alert.fingerprint, alert.type, alert.severity, JSON.stringify(alert.details)]);
  }
  return { evaluated: alerts.length, eventId: job.data.eventId };
}, { connection: { url: redisUrl }, concurrency: 5 });

worker.on('failed', (job, error) => console.error({ jobId: job?.id, error: error.message }, 'Inventory alert evaluation failed'));
async function shutdown() { await worker.close(); await pool.end(); process.exit(0); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
