# SIAB Platform Landing

Static marketing site for **Site in a Box** (siteinabox.nl), built with Astro 5 +
Tailwind 4. Intake product work belongs in `apps/intake`; landing CTAs link to
`/intake`.

Pushes to `main` build and publish an OCI image to
`ghcr.io/optidigi/siteinabox-site` via the compatibility monorepo workflow in
`.github/workflows/build-site-image.yml`. The VPS pulls the image via
`docker compose pull && docker compose up -d`.

Production Traefik routing is declared in `compose.yml`. The marketing router
serves both `siteinabox.nl` and `www.siteinabox.nl`; the separate intake router
has higher priority for `/intake`.

Source content (text, imagery, Lottie hero) was migrated verbatim from the upstream PHP `siab-landing-standalone`. The jQuery / Bootstrap-bundle / Slick / WOW stack was dropped during the Astro port; interactive bits (mobile nav, pricing tabs, FAQ accordion, sticky header, reduced-motion Lottie) are handled by a small inline script in `BaseLayout.astro`.

## Local development

```bash
pnpm install
pnpm dev              # http://localhost:4321 (HMR; perf scores are not representative)
pnpm build            # static output → dist/
pnpm astro preview --port 4322   # production server for Lighthouse / audit work
```

`SITE_URL` defaults to `https://example.com`; pass `SITE_URL=https://siteinabox.nl` for canonical/OG URLs to render correctly during local builds. The CI build-arg is already pinned to `https://siteinabox.nl`.

## Out of scope for this engagement

Signup/login, algemene-voorwaarden, and privacy-policy pages are intentionally deferred — CTAs that would point at the signup/login pages currently mailto `info@siteinabox.nl`. The legal-page links in the footer and the contact-form consent text still reference `/algemene-voorwaarden` and `/privacy-policy`; swap them for mailto fallbacks or real routes once a decision is made.
