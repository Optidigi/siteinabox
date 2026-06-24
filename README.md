# siteinabox

Monorepo shell for the SIAB platform.

## Layout

```txt
apps/
  cms/              # Payload CMS app, formerly siab-payload
  site/             # public siteinabox.nl site, formerly site-siteinabox
  builder/          # future client-facing builder app

packages/
  contracts/        # shared data contracts
  ui/               # shared UI primitives/components
  site-template/    # generated-site baseline, formerly siab-site-template
  site-themes/      # generated-site themes, formerly siab-site-themes
  tools/
    siab-orchestrator/
      commands/     # legacy /new-site and /add-cms command contracts
      workflows/    # separate sitegen and CMS conversion workflows
      scripts/      # CMS conversion helpers
      runbooks/

sites/
  ami-care/         # generated CMS-backed tenant site, formerly site-amicare-zorg
  amblast/          # generated/client site, formerly site-amblast
```

Planned future paths: `apps/runtime` and `packages/site-runtime`.

## Architecture Direction

The future SIAB product architecture is app-based, not per-client source
generation:

- `apps/site` is the public marketing site.
- `apps/builder` is the future client-facing intake, generator, authenticated
  preview, approval, payment handoff, and publish trigger app.
- `apps/cms` is the Payload admin/editor and tenant/content control plane.
- `apps/runtime` will be the public live tenant renderer when implementation
  reaches that phase.
- `packages/ui` owns shared UI primitives and reusable components for CMS and
  Builder.
- `packages/contracts` owns shared data contracts.
- `packages/site-runtime` will become the shared renderer used for Builder
  preview, live runtime, and editor consistency.

The existing orchestrators, `packages/site-template`, `packages/site-themes`,
and `sites/*` source folders are legacy/transition paths. Do not use them as the
future product model for new self-serve sites. See
`docs/decisions/builder-platform.md` for the canonical decision record.

## Deployment Contract

The monorepo publishes new platform-owned images:

- `apps/cms` publishes `ghcr.io/optidigi/siteinabox-cms:latest`.
- `apps/site` publishes `ghcr.io/optidigi/siteinabox-site:latest`.
- `apps/builder` is a reserved future platform app; no service/image is deployed
  yet.
- Generated/client site source lives under `sites/`. Current tenant site
  deployments publish monorepo-owned images:
  `ghcr.io/optidigi/siteinabox-site-ami-care:latest` and
  `ghcr.io/optidigi/siteinabox-site-amblast:latest`.
- VPS stack files live under `/srv/saas/infra/stacks/siteinabox/`, while
  tenant data paths stay unchanged under `/srv/data/saas/siab-payload/`.
- Traefik remains the edge proxy; routing stays compose-label based.

## Useful Checks

```bash
pnpm cms:typecheck
pnpm cms:test
pnpm site:build
pnpm builder:build
pnpm builder:test
pnpm tenant:amicare:build
pnpm tenant:amblast:build
pnpm template:build
pnpm orchestrator:test
```
