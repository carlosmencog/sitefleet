# Local Lighthouse audits

SiteFleet audits every connected local WordPress site directly from the dashboard. It uses Chromium and Lighthouse inside the local dashboard container, so the site stays private: no public URL, PageSpeed API key, VPS, or external SiteFleet API is involved.

## Run an audit

1. Keep the local WordPress site running.
2. Open that site's detail page in SiteFleet.
3. In **Site performance**, press **Run audit**.

SiteFleet runs two reports against the URL supplied by the SiteFleet agent: Mobile and Desktop. It stores the newest snapshot locally and displays Performance, Accessibility, Best Practices, SEO, LCP, CLS, INP when the audit can calculate it, FCP, and the highest-impact optimization opportunities.

## Local hostname access

The dashboard container uses the resolver rule in `.env` to make local WordPress hostnames such as `templates.local` reachable through Docker Desktop:

```dotenv
LOCAL_LIGHTHOUSE_RESOLVER_RULES=MAP *.local host.docker.internal
```

This is the default in `compose.yaml`. If the dashboard runs directly on the host instead of Docker, use `MAP *.local 127.0.0.1` or remove the variable if local DNS already resolves the sites.

## Boundaries

- Audits run only when a dashboard user presses **Run audit**.
- They never change WordPress, install updates, or send the report to a third party.
- The scores and Core Web Vitals are Lighthouse lab data from the local environment, not Chrome UX Report field data from real visitors.
- This workflow is deliberately local for the portfolio/demo phase. A production agency deployment can add remote runner infrastructure later without changing the WordPress inventory flow.
