import { createHmac, timingSafeEqual } from 'node:crypto';
import Fastify from 'fastify';
import { z } from 'zod';
import { InMemoryAgentStore, type AgentStore } from './repository.js';
import { NoopAlertQueue, type AlertQueue } from './alert-queue.js';
import { InMemoryRegistrationTokenStore, type RegistrationTokenStore } from './registration-token-store.js';

const registerSchema = z.object({ siteUrl: z.string().url(), registrationToken: z.string().min(16) });
const inventorySchema = z.object({
  wordpressVersion: z.string().min(1),
  phpVersion: z.string().min(1),
  plugins: z.array(z.object({ slug: z.string().min(1), version: z.string().min(1), updateAvailable: z.boolean() })),
  themes: z.array(z.object({ slug: z.string().min(1), version: z.string().min(1), updateAvailable: z.boolean() })),
  collectedAt: z.string().datetime({ offset: true }),
});

type AppOptions = { registrationToken?: string; registrationTokenStore?: RegistrationTokenStore; store?: AgentStore; alertQueue?: AlertQueue };

function equalSignature(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(received, 'hex');
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function buildApp({ registrationToken, registrationTokenStore = new InMemoryRegistrationTokenStore(registrationToken ? [registrationToken] : []), store = new InMemoryAgentStore(), alertQueue = new NoopAlertQueue() }: AppOptions) {
  const app = Fastify({ logger: true, bodyLimit: 256 * 1024 });
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    const raw = typeof body === 'string' ? body : body.toString('utf8');
    request.rawBody = raw;
    try { done(null, JSON.parse(raw)); }
    catch { done(new Error('Invalid JSON')); }
  });

  app.get('/', async () => ({ service: 'SiteFleet API', status: 'ok', health: '/health' }));
  app.get('/health', async () => ({ status: 'ok' }));

  app.post('/v1/agent/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid registration request' });
    if (!(await registrationTokenStore.consume(parsed.data.registrationToken))) {
      return reply.code(401).send({ error: 'Invalid registration token' });
    }
    let agent;
    try { agent = await store.create(parsed.data.siteUrl); }
    catch (error) {
      if ((error as { code?: string }).code === '23505') return reply.code(409).send({ error: 'This site is already connected' });
      throw error;
    }
    return reply.code(201).send({ agentId: agent.id, siteId: agent.siteId, agentSecret: agent.secret });
  });

  app.post('/v1/agent/inventory', async (request, reply) => {
    const agentId = request.headers['x-sitefleet-agent-id'];
    const timestamp = request.headers['x-sitefleet-timestamp'];
    const signature = request.headers['x-sitefleet-signature'];
    const idempotencyKey = request.headers['idempotency-key'];
    if (typeof agentId !== 'string' || typeof timestamp !== 'string' || typeof signature !== 'string' || typeof idempotencyKey !== 'string') {
      return reply.code(400).send({ error: 'Missing agent authentication headers' });
    }
    const timestampMs = Number(timestamp) * 1000;
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
      return reply.code(401).send({ error: 'Expired or invalid timestamp' });
    }
    const agent = await store.find(agentId);
    if (!agent) return reply.code(401).send({ error: 'Unknown agent' });
    const rawPayload = `POST\n/v1/agent/inventory\n${timestamp}\n${request.rawBody ?? ''}`;
    const canonicalPayload = `POST\n/v1/agent/inventory\n${timestamp}\n${JSON.stringify(request.body)}`;
    const rawSignature = createHmac('sha256', agent.secret).update(rawPayload).digest('hex');
    const canonicalSignature = createHmac('sha256', agent.secret).update(canonicalPayload).digest('hex');
    if (!equalSignature(rawSignature, signature) && !equalSignature(canonicalSignature, signature)) return reply.code(401).send({ error: 'Invalid request signature' });
    const parsed = inventorySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid inventory payload' });
    const saved = await store.saveInventory(agent.id, idempotencyKey, parsed.data);
    if (saved.eventId !== undefined) await alertQueue.enqueue({ eventId: saved.eventId, agentId: agent.id, inventory: parsed.data });
    return reply.code(saved.created ? 202 : 200).send({ accepted: true, duplicate: !saved.created });
  });

  return app;
}
