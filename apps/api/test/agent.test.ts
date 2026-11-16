import { createHmac, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app.js';

const token = 'test-registration-token-long-enough';
const inventory = { wordpressVersion: '6.8', phpVersion: '8.3', plugins: [{ slug: 'akismet', version: '5.3', updateAvailable: false }], themes: [], collectedAt: '2026-11-15T12:00:00.000Z' };

test('registers an agent and accepts a signed inventory only once', async () => {
  const app = buildApp({ registrationToken: token });
  const registration = await app.inject({ method: 'POST', url: '/v1/agent/register', payload: { siteUrl: 'https://example.test', registrationToken: token } });
  assert.equal(registration.statusCode, 201);
  const credentials = registration.json() as { agentId: string; agentSecret: string };
  const repeatedRegistration = await app.inject({ method: 'POST', url: '/v1/agent/register', payload: { siteUrl: 'https://second.example.test', registrationToken: token } });
  assert.equal(repeatedRegistration.statusCode, 401);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const raw = JSON.stringify(inventory);
  const signature = createHmac('sha256', credentials.agentSecret).update(`POST\n/v1/agent/inventory\n${timestamp}\n${raw}`).digest('hex');
  const headers = { 'x-sitefleet-agent-id': credentials.agentId, 'x-sitefleet-timestamp': timestamp, 'x-sitefleet-signature': signature, 'idempotency-key': randomUUID() };
  const first = await app.inject({ method: 'POST', url: '/v1/agent/inventory', headers, payload: inventory });
  assert.equal(first.statusCode, 202);
  const duplicate = await app.inject({ method: 'POST', url: '/v1/agent/inventory', headers, payload: inventory });
  assert.equal(duplicate.statusCode, 200);
  assert.deepEqual(duplicate.json(), { accepted: true, duplicate: true });
  await app.close();
});

test('rejects an invalid signature', async () => {
  const app = buildApp({ registrationToken: token });
  const result = await app.inject({ method: 'POST', url: '/v1/agent/inventory', headers: { 'x-sitefleet-agent-id': 'unknown', 'x-sitefleet-timestamp': String(Math.floor(Date.now() / 1000)), 'x-sitefleet-signature': 'invalid', 'idempotency-key': randomUUID() }, payload: inventory });
  assert.equal(result.statusCode, 401);
  await app.close();
});
