# Legacy Tenant Site Snapshots

Legacy/current tenant site snapshots live here. This directory is not a target
for new generated sites.

Current production tenant snapshot images are monorepo-owned:

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
from `packages/site-template`.

Do not create new folders under `sites/*` for generated sites. Future
generation must create validated CMS tenant, site, page, theme, SEO, and
publishing data. That data will be previewed through CMS rendering surfaces and,
once implemented, served publicly by the generic `apps/renderer` runtime using
shared logic from `packages/site-renderer`.

## Image Build Convention

The existing tenant snapshot workflows are legacy/current deploy contracts.
Tenant snapshots that consume shared packages must build from the monorepo root
Docker context:

```yaml
with:
  context: .
  file: sites/<slug>/Dockerfile
  build-args: |
    SITE_DIR=sites/<slug>
```

This lets Docker see both `sites/<slug>` and shared packages such as
`packages/contracts`. Keep existing tenant-specific image names stable unless
the operator explicitly approves a deploy contract change. Do not add new
tenant-specific image workflows for future generated sites.
