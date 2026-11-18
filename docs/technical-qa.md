# Technical QA

Technical QA is SiteFleet's crawl-based review for objective website failures. It complements Lighthouse: Lighthouse measures a page experience while Technical QA checks the site structure and response behavior across internal pages.

## What it checks

- Internal pages returning HTTP 4xx or 5xx responses.
- Same-origin images, scripts, and stylesheets that cannot be loaded.
- Images without an `alt` attribute.
- Missing document titles or meta descriptions.
- Missing H1 headings and pages with multiple H1 headings.

## Scope and boundaries

The crawler starts at the WordPress URL reported by the connected SiteFleet agent, follows same-origin links only, and caps the local demo crawl at 15 pages and 60 resources. It runs only when a dashboard user presses **Run technical QA** and stores the latest snapshot locally.

It deliberately does not make subjective visual decisions such as whether a button has enough padding. It also does not replace manual accessibility review, content review, authenticated user-flow testing, or production monitoring.
