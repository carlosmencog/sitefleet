import { createHmac, timingSafeEqual } from 'node:crypto';
import Fastify from 'fastify';
import { z } from 'zod';
import { AgentRepository } from './repository.js';

const registerSchema = z.object({ siteUrl: z.string().url(), registrationToken: z.string().min(16) });
const inventorySchema = z.object({
  wordpressVersion: z.string().min(1),
  phpVersion: z.string().min(1),
  plugins: z.array(z.object({ slug: z.string().min(1), version: z.string().min(1), updateAvailable: z.boolean() })),
  themes: z.array(z.object({ slug: z.string().min(1), version: z.string().min(1), updateAvailable: z.boolean() })),
  collectedAt: z.string().datetime(),
});

type AppOptions = { registrationToken: string; repository?: AgentRepository };

function equalSignature(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(received, 'hex');
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function buildApp({ registrationToken, repository = new AgentRepository() }: AppOptions) {
  const app = Fastify({ logger: true, bodyLimit: 256 * 1024 });

  app.get('/health', async () => ({ status: 'ok' }));

  app.post('/v1/agent/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid registration request' });
    if (!equalSignature(createHmac('sha256', registrationToken).update(parsed.data.registrationToken).digest('hex'), createHmac('sha256', registrationToken).update(registrationToken).digest('hex'))) {
      return reply.code(401).send({ error: 'Invalid registration token' });
    }
    const agent = repository.create(parsed.data.siteUrl);
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
    const agent = repository.find(agentId);
    if (!agent) return reply.code(401).send({ error: 'Unknown agent' });
    const rawBody = JSON.stringify(request.body);
    const signedPayload = `POST\n/v1/agent/inventory\n${timestamp}\n${rawBody}`;
    const expected = createHmac('sha256', agent.secret).update(signedPayload).digest('hex');
    if (!equalSignature(expected, signature)) return reply.code(401).send({ error: 'Invalid request signature' });
    const parsed = inventorySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid inventory payload' });
    const created = repository.saveInventory(agent, idempotencyKey, parsed.data);
    return reply.code(created ? 202 : 200).send({ accepted: true, duplicate: !created });
  });

  return app;
}
