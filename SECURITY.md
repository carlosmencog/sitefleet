# Security policy

## Reporting a vulnerability

Please do not open a public issue for a suspected security vulnerability. Contact the repository owner privately with a concise description, affected component, and reproduction steps. Acknowledgement and a remediation path will be provided as soon as practical.

## Deployment baseline

Before connecting public WordPress sites, follow [the production onboarding guide](docs/production-onboarding.md). In particular:

- Serve the API only over HTTPS outside local/development environments.
- Keep PostgreSQL and Redis on a private network.
- Store `SITEFLEET_ENCRYPTION_KEY` and dashboard credentials in a secret manager or deployment environment.
- Add rate limits at the edge for enrollment and inventory routes.
- Use unique, short-lived enrollment tokens per site.

The current threat model is maintained in [docs/threat-model.md](docs/threat-model.md).
