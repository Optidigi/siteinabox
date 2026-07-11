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

## Legal publications

Versioned legal source lives in `packages/legal-content`. The current aliases,
permanent historical URLs, and `/.well-known/siab-legal-manifest.json` are built
from that immutable registry. Run `pnpm legal:check` from the repository root
before publishing a new legal release.
