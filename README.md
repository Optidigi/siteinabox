# siteinabox

Monorepo shell for the SIAB platform.

## Layout

```txt
apps/
  cms/              # Payload CMS app, formerly siab-payload
  landing/          # public siteinabox.nl marketing site
  intake/           # public intake app for www.siteinabox.nl/intake
  renderer/         # generic public runtime for generated sites

packages/
  contracts/        # shared data contracts
  ui/               # shared UI primitives/components
  site-renderer/    # shared CMS/public rendering core
```

## Architecture Direction

SIAB uses data-driven site generation. Generation creates validated CMS tenant
data, not source code.

Current invariants:

- `apps/landing` is the public marketing site.
- `apps/intake` owns the public intake surface at `www.siteinabox.nl/intake`.
- `apps/cms` is the Payload admin/editor and tenant/content control plane.
- `apps/renderer` is the generic public runtime. It resolves a tenant by host,
  loads an active published site snapshot, and serves the live generated site
  without tenant-specific logic.
- `packages/ui` owns shared UI primitives and reusable components.
- `packages/contracts` owns shared data contracts.
- `packages/site-renderer` is the shared rendering package used by CMS
  preview/customizer surfaces and by `apps/renderer`.
- Tenant-specific app source folders under `sites/*` have been removed.
  Renderer/CMS snapshot data is now canonical.
- `packages/contracts/src/site.ts` owns the canonical generated-site block slug
  contract. `packages/contracts/src/block-catalog.ts` owns approved block
  provenance, variants, and editable-field metadata. CMS block schemas live in
  `apps/cms/src/blocks/`, and live/preview rendering lives in
  `packages/site-renderer/src/blocks/`.
- Cloudflare Email Sending is the canonical mail path. The CMS sends runtime
  mail through Cloudflare's REST Email Sending API, keeps SMTP only as a
  fallback, uses Cloudflare's API to provision/refresh tenant sending
  subdomains, and records metadata-only mail logs and operational alerts.
  Tenant generated-site activation requires verified tenant Email Sending state.
  Do not add a second transactional mail provider without an approved
  architecture decision.
- Generated-site analytics are PostHog-first by default through the shared
  projection and renderer contracts. Public capture remains consent-gated and
  only becomes active when the deployment has the required PostHog token/env.

New generated sites must create validated tenant, site, page, theme, SEO, and
publishing data. They must not create per-client folders under `sites/*`,
tenant-specific source files, tenant-specific GitHub workflows, tenant-specific
Docker images, or arbitrary executable code.

See [Data-Driven Site Generation](docs/architecture/data-driven-site-generation.md)
for the current generation contract.

## Deployment Contract

The monorepo publishes new platform-owned images:

- `apps/cms` publishes `ghcr.io/optidigi/siteinabox-cms:latest`.
- `apps/intake` publishes `ghcr.io/optidigi/siteinabox-intake:latest`.
- `apps/landing` publishes the compatibility image
  `ghcr.io/optidigi/siteinabox-site:latest`.
- `apps/renderer` publishes `ghcr.io/optidigi/siteinabox-renderer:latest`.
- Generated sites are served by the generic renderer from active published
  snapshots, not by per-tenant images.
- VPS stack files live under `/srv/saas/infra/stacks/siteinabox/`, while
  tenant data paths stay unchanged under `/srv/data/saas/siab-payload/`.
- Traefik remains the edge proxy; routing stays compose-label based.
- Public marketing routes for both `siteinabox.nl` and `www.siteinabox.nl`
  belong to `apps/landing`; `/intake` on both hosts belongs to `apps/intake`.
  See `docs/architecture/route-surface-inventory.md`.

## Useful Checks

```bash
pnpm cms:typecheck
pnpm cms:test
pnpm site:build
pnpm landing:build
pnpm intake:build
pnpm renderer:deploy-contract
pnpm renderer:build
```

## Tooling State

- Work normally starts from this monorepo root.
- MCP definitions are mirrored at the root and under `apps/cms`; see
  `AGENTS.md` for the canonical server list and MCP use policy. Domain-specific
  MCPs are expected for matching work, for example Cloudflare work uses the
  Cloudflare MCP and Better Auth work uses the Better Auth MCP.
- Repo-local command prompt directories have been removed. `.codex/` is config
  only.
- There are no repo-local skills. Global/user skills may exist outside this
  repository and are not part of the SIAB platform contract.
