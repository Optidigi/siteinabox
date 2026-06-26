# SIAB Platform Intake

Public intake app boundary for `www.siteinabox.nl/intake`.

This app currently contains the extracted demo intake scaffold that used to live
inside the marketing app. The operator-owned full intake app can replace or
extend this boundary later, but future intake product work should stay here
rather than in `apps/landing`.

## Local development

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
```

`PUBLIC_INTAKE_API_URL` defaults to `/api/intake`. Production should route that
path to the CMS intake API unless a later deploy contract chooses another stable
CMS origin.
