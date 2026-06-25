# Tenant Site Snapshots

Current tenant site snapshots live here.

Current production tenant site images are monorepo-owned:

- `sites/ami-care` deploys as `ghcr.io/optidigi/siteinabox-site-ami-care:latest`.
- `sites/amblast` deploys as `ghcr.io/optidigi/siteinabox-site-amblast:latest`.

VPS stack files now live under `/srv/saas/infra/stacks/siteinabox/tenants/`.
Tenant data paths remain unchanged under `/srv/data/saas/siab-payload/`.

Current shape:

```txt
sites/
  amblast/
  ami-care/
```

Existing tenant snapshots may continue to consume shared contracts
from `packages/site-template`. Do not use this generated-source model for new
self-serve sites while the platform architecture is being reconsidered.

## Image Build Convention

Tenant sites that consume shared packages must build from the monorepo root
Docker context. Tenant image workflows should use:

```yaml
with:
  context: .
  file: sites/<slug>/Dockerfile
  build-args: |
    SITE_DIR=sites/<slug>
```

This lets Docker see both `sites/<slug>` and shared packages such as
`packages/contracts`. Keep tenant-specific image names stable unless the
operator explicitly approves a deploy contract change.
