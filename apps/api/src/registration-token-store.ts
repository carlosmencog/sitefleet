import { createHash } from 'node:crypto';
import type { Pool } from 'pg';

export interface RegistrationTokenStore {
  consume(token: string): Promise<boolean>;
}

export const hashRegistrationToken = (token: string) => createHash('sha256').update(token).digest('hex');

export class InMemoryRegistrationTokenStore implements RegistrationTokenStore {
  private readonly tokens = new Set<string>();

  constructor(tokens: string[]) {
    for (const token of tokens) this.tokens.add(hashRegistrationToken(token));
  }

  async consume(token: string) {
    return this.tokens.delete(hashRegistrationToken(token));
  }
}

export class PostgresRegistrationTokenStore implements RegistrationTokenStore {
  constructor(private readonly pool: Pool) {}

  async consume(token: string) {
    const result = await this.pool.query(
      `UPDATE registration_tokens
       SET consumed_at = now()
       WHERE token_hash = $1
         AND consumed_at IS NULL
         AND (expires_at IS NULL OR expires_at > now())
       RETURNING id`,
      [hashRegistrationToken(token)],
    );
    return result.rowCount === 1;
  }
}
