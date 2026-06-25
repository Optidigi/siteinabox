# siteinabox

Monorepo shell for the SIAB platform.

## Layout

```txt
apps/
  cms/              # Payload CMS app, formerly siab-payload
  site/             # public siteinabox.nl site, formerly site-siteinabox

packages/
  contracts/        # shared data contracts
  ui/               # shared UI primitives/components
  site-template/    # renderer/reference for current tenant snapshots

sites/
  ami-care/         # CMS-backed tenant snapshot, formerly site-amicare-zorg
  amblast/          # tenant snapshot, formerly site-amblast
```

## Architecture Direction

The next SIAB product architecture is under reconsideration. Current invariants:

- `apps/site` is the public marketing site.
- `apps/cms` is the Payload admin/editor and tenant/content control plane.
- `packages/ui` owns shared UI primitives and reusable components.
- `packages/contracts` owns shared data contracts.

Do not restore command-driven site generation workflows or create new per-client
source folders while the platform architecture is being reworked. New generation
work should wait for an approved architecture decision and should produce
validated structured data rather than arbitrary source code.

## Deployment Contract

The monorepo publishes new platform-owned images:

- `apps/cms` publishes `ghcr.io/optidigi/siteinabox-cms:latest`.
- `apps/site` publishes `ghcr.io/optidigi/siteinabox-site:latest`.
- Existing tenant snapshots under `sites/` still publish monorepo-owned images:
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
