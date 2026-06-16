# CMS Artifact Sync

CMS-backed sites build tenant canvas assets into the site image at:

- `/app/dist/cms/cms-editor.css`
- `/app/dist/cms/files/*`

Payload reads those same assets from the tenant data directory:

- `/srv/data/saas/siab-payload/tenants/<tenantId>/cms-editor.css`
- `/srv/data/saas/siab-payload/tenants/<tenantId>/files/*`

Run the sync after the site image is published and before restarting the site
container:

```bash
scripts/sync-cms-artifacts.sh \
  --image ghcr.io/optidigi/siteinabox-site-<slug>:latest \
  --tenant-dir /srv/data/saas/siab-payload/tenants/<tenantId>
```

Run it on the Docker host that can write the Payload tenant directory. If the
script is not checked out on that host, copy `scripts/sync-cms-artifacts.sh`
there first or run it through a Docker context that has access to the same
filesystem.

After the sync, the site container should mount the tenant data directory
read-only:

```yaml
volumes:
  - /srv/data/saas/siab-payload/tenants/<tenantId>:/data:ro
```

This replaces the older per-site entrypoint workaround that copied
`/app/dist/cms/*` into `/data` on every container start and required a writable
tenant data mount.
