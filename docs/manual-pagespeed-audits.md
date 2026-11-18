# Manual PageSpeed audits

SiteFleet can audit a public production URL while the dashboard and database remain local. This is a manual action only: no WordPress cron, no external SiteFleet API, and no changes to the audited site.

## Use it locally

1. Open a site detail in the dashboard.
2. Under **Site performance**, save its public production URL. This can differ from the local WordPress URL used for inventory.
3. Click **Run audit**. SiteFleet requests mobile and desktop reports from Google PageSpeed Insights, then stores the normalized snapshot locally.

The detail page displays Performance, Accessibility, Best Practices, SEO, LCP, CLS, INP, FCP, and the four highest estimated savings opportunities for each strategy.

## API key

PageSpeed can receive requests without a key for light local use. For repeatable demonstrations, add a Google PageSpeed API key only to your local `.env` file:

```dotenv
PAGESPEED_API_KEY=your-key
```

Restart the dashboard container after changing the environment. The key is used only server-side and is never sent to the browser or WordPress plugin.

## Boundaries

- The target URL must be publicly reachable through HTTP or HTTPS; `localhost` is rejected.
- Audits happen only when the dashboard user presses **Run audit**.
- Results live in the local PostgreSQL database and are intended for demos, documentation, and portfolio evidence.
