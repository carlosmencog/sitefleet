import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

export type Agent = { id: string; siteId: string; siteUrl: string; secret: string };

export interface AgentStore {
  create(siteUrl: string): Promise<Agent>;
  find(id: string): Promise<Agent | undefined>;
  saveInventory(agentId: string, idempotencyKey: string, inventory: unknown): Promise<boolean>;
}

export class InMemoryAgentStore implements AgentStore {
  private readonly agents = new Map<string, Agent>();
  private readonly processedKeys = new Set<string>();

  async create(siteUrl: string) {
    const agent = { id: randomUUID(), siteId: randomUUID(), siteUrl, secret: randomBytes(32).toString('base64url') };
    this.agents.set(agent.id, agent);
    return agent;
  }

  async find(id: string) { return this.agents.get(id); }

  async saveInventory(agentId: string, idempotencyKey: string, _inventory: unknown) {
    const key = `${agentId}:${idempotencyKey}`;
    if (this.processedKeys.has(key)) return false;
    this.processedKeys.add(key);
    return true;
  }
}

type EncryptedValue = { ciphertext: Buffer; iv: Buffer; tag: Buffer };

function encrypt(value: string, key: Buffer): EncryptedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  return { ciphertext: Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]), iv, tag: cipher.getAuthTag() };
}

function decrypt(value: EncryptedValue, key: Buffer) {
  const decipher = createDecipheriv('aes-256-gcm', key, value.iv);
  decipher.setAuthTag(value.tag);
  return Buffer.concat([decipher.update(value.ciphertext), decipher.final()]).toString('utf8');
}

export class PostgresAgentStore implements AgentStore {
  constructor(private readonly pool: Pool, private readonly encryptionKey: Buffer) {
    if (encryptionKey.length !== 32) throw new Error('SITEFLEET_ENCRYPTION_KEY must decode to exactly 32 bytes');
  }

  async create(siteUrl: string) {
    const agent = { id: randomUUID(), siteId: randomUUID(), siteUrl, secret: randomBytes(32).toString('base64url') };
    const encrypted = encrypt(agent.secret, this.encryptionKey);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO sites (id, site_url) VALUES ($1, $2)', [agent.siteId, siteUrl]);
      await client.query('INSERT INTO agents (id, site_id, secret_hash, secret_ciphertext, secret_iv, secret_tag) VALUES ($1, $2, $3, $4, $5, $6)', [agent.id, agent.siteId, createHash('sha256').update(agent.secret).digest('hex'), encrypted.ciphertext, encrypted.iv, encrypted.tag]);
      await client.query('COMMIT');
      return agent;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async find(id: string) {
    const result = await this.pool.query('SELECT a.id, a.site_id, s.site_url, a.secret_ciphertext, a.secret_iv, a.secret_tag FROM agents a JOIN sites s ON s.id = a.site_id WHERE a.id = $1', [id]);
    const row = result.rows[0];
    if (!row) return undefined;
    return { id: row.id, siteId: row.site_id, siteUrl: row.site_url, secret: decrypt({ ciphertext: row.secret_ciphertext, iv: row.secret_iv, tag: row.secret_tag }, this.encryptionKey) };
  }

  async saveInventory(agentId: string, idempotencyKey: string, inventory: unknown) {
    const result = await this.pool.query("INSERT INTO inventory_events (agent_id, idempotency_key, payload, collected_at) VALUES ($1, $2, $3::jsonb, ($3::jsonb ->> 'collectedAt')::timestamptz) ON CONFLICT (agent_id, idempotency_key) DO NOTHING", [agentId, idempotencyKey, JSON.stringify(inventory)]);
    return result.rowCount === 1;
  }
}
