# Ami-care Tenant Site

One-pager for Amicare-Zorg. Static site, deployed to https://ami-care.nl
via Coolify (Docker, Traefik) on the Optidigi VPS.

## Local development

```bash
pnpm install
pnpm dev          # http://localhost:4321
pnpm build        # → dist/
pnpm preview      # serves dist/ for sanity check
pnpm og           # regenerate public/og.png
```

## Deploy

Push to `main`. The root GitHub Actions workflow
`.github/workflows/build-tenant-amicare-image.yml` builds
the Docker image and pushes it to
`ghcr.io/optidigi/siab-platform-site-ami-care:latest`.

On the VPS (`/srv/saas/infra/stacks/siab-platform/tenants/ami-care/`), from a
checkout that contains the monorepo orchestrator tools:

```bash
packages/tools/siab-orchestrator/scripts/sync-cms-artifacts.sh \
  --image ghcr.io/optidigi/siab-platform-site-ami-care:latest \
  --tenant-dir /srv/data/saas/siab-payload/tenants/7

cd /srv/saas/infra/stacks/siab-platform/tenants/ami-care
docker compose pull
docker compose up -d
```

Public traffic is routed by the shared Traefik edge. The production compose
joins the external `proxy` docker network and declares the public
`ami-care.nl` route with Traefik labels.

## Design

See [`docs/superpowers/specs/2026-05-01-amicare-zorg-design.md`](docs/superpowers/specs/2026-05-01-amicare-zorg-design.md)
for the design spec and content. See `docs/superpowers/plans/` for the
implementation plan.

## CMS editor CSS bundling

For the siab-payload canvas editor, this site exposes a bundled stylesheet:

- **Production**: `pnpm build` runs `astro build && node scripts/build-cms-css.mjs`,
  producing `dist/cms/cms-editor.css` that the CMS reads from
  `<DATA_DIR>/tenants/<id>/cms-editor.css`. Run
  `packages/tools/siab-orchestrator/scripts/sync-cms-artifacts.sh` after each
  image build and before restarting the site container.

- **Local dev**: run `pnpm dev:cms-css` alongside `pnpm dev` to watch
  `src/styles/{global,rich-text}.css` and concatenate them into
  `../siab-payload/.data-out/tenants/<TENANT_ID>/cms-editor.css` for the CMS
  to consume live.

## CMS-backed mode

This package is shaped for the monorepo
`packages/tools/siab-orchestrator` `/add-cms` workflow.
Editorial content (page copy, brand info) lives in `src/content/` pre-conversion, and in
the Payload tenant volume (`/data/`) post-conversion.

### One-time post-`/add-cms` restructure step

The orchestrator's payload-seeder seeds every markdown H2 section as a single
`richText` block. The site's CMS renderers, however, light up the full Zen visual
treatment only when blocks are structured (Hero, FeatureList, RichText, CTA).

After `/add-cms` completes Phase 4 (and optionally before Phase 5/6 — order doesn't
matter), the operator runs:

```bash
cd sites/ami-care
bash scripts/restructure-cms.sh <TENANT_ID>
```

This PATCHes the home page on Payload to replace the 5 seeded richText blocks
with 1×Hero + 1×FeatureList + 1×RichText + 1×CTA(quote) + 1×CTA(contact),
matching the section structure the renderers expect.

The Payload `afterChange` hook writes the updated JSON to
`/srv/data/saas/siab-payload/tenants/<TENANT_ID>/pages/index.json` on the VPS;
the next request to the SSR site renders with full Zen design.

Editor changes in Payload admin after this point flow through normally
(JSON re-projected on save, next request reads fresh).

### Runtime details (post-conversion)

This site reads editorial content from a per-tenant Payload CMS data directory mounted into the container at `/data`. Editor changes are visible on the next request — there is no rebuild on content edits.

**Required runtime env:**

- `CMS_DATA_DIR` — defaults to `/data`. Where the per-tenant data is mounted.
- `SITE_URL` — public site URL (e.g. `https://ami-care.nl`).

**Required volume:**

- Mount the per-tenant data dir at `/data:ro`. See `docker-compose.cms.yml.example`.
- Do not mount `/data` read-write for CSS sync. CMS canvas artifacts are copied
  from the image by
  `packages/tools/siab-orchestrator/scripts/sync-cms-artifacts.sh`.

**Editor:**

The Payload tenant has an editor user; the operator manages account access.

**Failure modes:**

If `/data` is not mounted, or any page JSON is missing/malformed, the site renders with empty editorial fields. Pages always return 200; `/healthz` returns 200 unconditionally for container healthchecks.
