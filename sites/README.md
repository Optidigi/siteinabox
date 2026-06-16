# Generated Sites

Generated/client site repositories live here.

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

Generated sites should continue to consume the shared contracts from
`packages/site-template`, `packages/site-themes`, and the `/add-cms` workflow.
