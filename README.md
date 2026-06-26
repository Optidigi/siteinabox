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
  site-template/    # renderer/reference for current tenant snapshots

sites/
  ami-care/         # legacy/current CMS-backed tenant snapshot
  amblast/          # legacy/current tenant snapshot
```

## Architecture Direction

SIAB is moving toward data-driven site generation. Generation creates validated
CMS tenant data, not source code.

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
- `sites/*` contains only legacy/current tenant snapshots. Existing
  `sites/ami-care` and `sites/amblast` stay for maintenance and reference until
  they are migrated or archived.

New generated sites must create validated tenant, site, page, theme, SEO, and
publishing data. They must not create per-client folders under `sites/*`,
tenant-specific source files, tenant-specific GitHub workflows, tenant-specific
Docker images, or arbitrary executable code.

See [Data-Driven Site Generation](docs/architecture/data-driven-site-generation.md)
for the Phase 0 guardrails.

## Deployment Contract

The monorepo publishes new platform-owned images:

- `apps/cms` publishes `ghcr.io/optidigi/siteinabox-cms:latest`.
- `apps/landing` publishes the compatibility image
  `ghcr.io/optidigi/siteinabox-site:latest`.
- `apps/renderer` publishes `ghcr.io/optidigi/siteinabox-renderer:latest`.
- Existing tenant snapshots under `sites/` still publish monorepo-owned legacy
  images:
  `ghcr.io/optidigi/siteinabox-site-ami-care:latest` and
  `ghcr.io/optidigi/siteinabox-site-amblast:latest`.
- Generated sites are served by the generic renderer from active published
  snapshots, not by per-tenant images.
- VPS stack files live under `/srv/saas/infra/stacks/siteinabox/`, while
  tenant data paths stay unchanged under `/srv/data/saas/siab-payload/`.
- Traefik remains the edge proxy; routing stays compose-label based.

## Useful Checks

```bash
pnpm cms:typecheck
pnpm cms:test
pnpm site:build
pnpm landing:build
pnpm intake:build
pnpm tenant:amicare:build
pnpm tenant:amblast:build
pnpm template:build
```

## Tooling State

- Work normally starts from this monorepo root.
- MCP definitions are mirrored at the root and under `apps/cms`; see
  `AGENTS.md` for the canonical server list.
- Repo-local command prompt directories have been removed. `.codex/` is config
  only.
- There are no repo-local skills. Global/user skills may exist outside this
  repository and are not part of the SIAB platform contract.
