# SIAB Platform Intake

Public intake app boundary for `www.siteinabox.nl/intake`.

This app contains the public richer intake wizard. Future intake product work
should stay here rather than in `apps/landing`.

Production Traefik routing is declared in `compose.yml`. The intake router
serves `/intake` and `/intake/*` on both `siteinabox.nl` and
`www.siteinabox.nl`, with higher priority than the landing router.

## Local development

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
```

`PUBLIC_INTAKE_SUBMIT_ENDPOINT` defaults to `/api/intake`. KVK lookup endpoints
default to `/api/intake/kvk/search` and `/api/intake/kvk/profile`; they proxy
through CMS so no KVK credentials are exposed to the browser.
