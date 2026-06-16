# Generated Sites

Generated/client site repositories live here.

Current production tenant site images remain unchanged:

- `sites/ami-care` deploys as `ghcr.io/optidigi/site-amicare-zorg:latest`.
- `sites/amblast` deploys as `ghcr.io/optidigi/site-amblast:latest`.

VPS stack files now live under `/srv/saas/infra/stacks/siab-platform/tenants/`.
Tenant data paths remain unchanged under `/srv/data/saas/siab-payload/`.

Current shape:

```txt
sites/
  amblast/
  ami-care/
```

Generated sites should continue to consume the shared contracts from
`packages/site-template`, `packages/site-themes`, and the `/add-cms` workflow.
