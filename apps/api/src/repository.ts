import { createHash, randomBytes, randomUUID } from 'node:crypto';

export type Agent = {
  id: string;
  siteId: string;
  siteUrl: string;
  secret: string;
  secretHash: string;
  lastInventory?: unknown;
  processedKeys: Set<string>;
};

export class AgentRepository {
  private readonly agents = new Map<string, Agent>();

  create(siteUrl: string) {
    const secret = randomBytes(32).toString('base64url');
    const agent: Agent = {
      id: randomUUID(),
      siteId: randomUUID(),
      siteUrl,
      secret,
      secretHash: createHash('sha256').update(secret).digest('hex'),
      processedKeys: new Set(),
    };
    this.agents.set(agent.id, agent);
    return agent;
  }

  find(id: string) {
    return this.agents.get(id);
  }

  saveInventory(agent: Agent, idempotencyKey: string, inventory: unknown) {
    if (agent.processedKeys.has(idempotencyKey)) return false;
    agent.processedKeys.add(idempotencyKey);
    agent.lastInventory = inventory;
    return true;
  }
}
