# Architecture

## System boundary

SiteFleet is a local-first WordPress operations system. It separates receiving inventories from evaluating them so the WordPress admin experience stays quick and a transient worker failure does not require an administrator to repeat an action.

```text
WordPress + SiteFleet Agent
       | one-time enrollment / signed inventory
       v
Fastify API ───────────────> PostgreSQL
       |
       v
Redis / BullMQ ────────────> Inventory worker ───────────> PostgreSQL

Next.js dashboard ─────────> PostgreSQL
       |
       +── manual Lighthouse audit
       +── manual technical QA crawl
```

## Inventory flow

1. An operator creates a short-lived, single-use enrollment token from the API workspace.
2. The WordPress agent exchanges it once for an agent ID and secret. Only a token hash is retained.
3. The agent collects a small inventory: WordPress and PHP versions, active plugin and theme state, update availability, SSL state, and its site URL.
4. It signs `method + route + timestamp + body` using HMAC SHA-256 and sends an idempotency key.
5. The API validates the timestamp and signature, records the inventory, then queues evaluation.
6. The worker evaluates findings and writes the current operational state.
7. The dashboard reads the latest inventory and findings directly from PostgreSQL.

## Data and secret handling

- PostgreSQL holds site, agent, inventory, and finding data.
- Redis only transports asynchronous evaluation work.
- Agent secrets are encrypted with AES-256-GCM before persistence. `SITEFLEET_ENCRYPTION_KEY` stays in deployment configuration.
- The agent retains its secret locally after enrollment but does not reveal it again in the WordPress UI.
- Enrollment tokens, dashboard passwords, and environment files are not tracked by Git.

## Manual local checks

Lighthouse and Technical QA run from the dashboard only when an operator requests them. They are not background jobs and they do not mutate WordPress. This intentionally supports private `*.local` environments without a public audit API or cloud runner.

## Production evolution

The inventory protocol does not depend on the local-first dashboard. A production deployment can retain the same agent and API while adding HTTPS termination, rate limiting, secret management, observability, a private network for data stores, and remote audit runners.
