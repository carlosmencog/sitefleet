import { Queue } from 'bullmq';

export type InventoryJob = { eventId: number; agentId: string; inventory: unknown };

export interface AlertQueue {
  enqueue(job: InventoryJob): Promise<void>;
  close?(): Promise<void>;
}

export class NoopAlertQueue implements AlertQueue {
  async enqueue(_job: InventoryJob) {}
}

export class BullMqAlertQueue implements AlertQueue {
  private readonly queue: Queue<InventoryJob>;
  constructor(redisUrl: string) {
    this.queue = new Queue<InventoryJob>('inventory-alerts', { connection: { url: redisUrl } });
  }
  async enqueue(job: InventoryJob) {
    await this.queue.add('evaluate-inventory', job, { jobId: `event-${job.eventId}`, attempts: 5, backoff: { type: 'exponential', delay: 1_000 }, removeOnComplete: 1_000, removeOnFail: 5_000 });
  }
  async close() { await this.queue.close(); }
}
