# Production onboarding

The agent connects only to a publicly reachable HTTPS SiteFleet API. Do not put API keys, enrollment tokens, or encryption keys in the WordPress plugin files or in Git.

## Deploy the API

Deploy the API, PostgreSQL, Redis, and worker on the same private network. Put the API behind a TLS-terminating reverse proxy or a managed HTTPS service, and expose only the API over HTTPS. Keep PostgreSQL and Redis private.

Set these production secrets in the deployment platform:

- `DATABASE_URL`
- `REDIS_URL`
- `SITEFLEET_ENCRYPTION_KEY`: a unique 32-byte base64 value.
- `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD`: unique dashboard credentials.

Generate the encryption key with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

After the deployment starts, migrations run before the API accepts traffic. Confirm `https://your-api-domain/health` responds with `{"status":"ok"}`.

## Create a token for one site

Run this command from the deployed API container or job. It prints the secret once and stores only its hash.

```bash
npm run registration-token --workspace=@sitefleet/api -- --expires-hours=72
```

The output has a `registrationToken` and its expiration timestamp. Create a different token for every WordPress site. A token is invalid after use or expiry.

## Install the agent

1. Create a folder named `sitefleet-agent` inside `wp-content/plugins/`.
2. Upload `sitefleet-agent.php` from the release package to that folder and activate it.
3. Open **Tools → SiteFleet Agent**.
4. Enter the public HTTPS API URL and the one-time enrollment token.
5. Confirm the `Connected` notice. The plugin then sends an initial signed inventory and schedules subsequent inventories twice daily.

The plugin stores only its unique agent ID, site ID, and agent secret. It never displays or sends the enrollment token again. It refuses non-HTTPS endpoints outside a local or development WordPress environment.

## Operational guardrails

- Rate-limit `/v1/agent/register` and `/v1/agent/inventory` at the public proxy.
- Restrict dashboard access with a strong, unique password or your identity provider.
- Back up PostgreSQL and rotate the platform-level encryption key through a planned re-encryption migration.
- Treat a lost agent secret as a re-enrollment event: remove the old agent from the workspace, then create a new one-time token.
