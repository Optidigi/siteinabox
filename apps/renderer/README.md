# SIAB Renderer

Minimal public runtime for rendering published site snapshots through
`@siteinabox/site-renderer`.

This app renders immutable published snapshots from the CMS:

1. resolve a request pathname
2. resolve the request `Host` through the CMS snapshot endpoint
3. resolve the matching published page
4. render shared site-renderer output with theme tokens and SEO metadata

The app intentionally does not implement AI, intake, CMS writes, payment, or
domain/DNS automation.

`src/pages/_renderer/editor.astro` is a renderer-owned isolated iframe smoke
route for the public renderer runtime. It is not the CMS page-editor iframe
surface; CMS editing is hosted by `apps/cms` under `/__editor-frame` and keeps
RHF/save/sidebar state in the CMS parent document.

## Deployment Contract

Production image:

- `ghcr.io/optidigi/siteinabox-renderer`

Production compose template:

- repo: `apps/renderer/compose.yml`
- VPS target path:
  `/srv/saas/infra/stacks/siteinabox/apps/renderer/compose.yml`

Required production environment:

- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `PORT=4321`
- `SIAB_CMS_URL` - absolute URL for the CMS app. The renderer calls
  `/api/renderer/snapshot?host=<host>` on this origin for every request.
- `SIAB_RENDERER_API_TOKEN` - shared bearer token sent by the renderer and
  checked by the CMS snapshot endpoint. Use the same value in both apps. In
  production this is required: if the CMS has no token configured, the endpoint
  rejects renderer requests instead of serving snapshots anonymously.
- `DATA_DIR` - shared tenant data root mounted read-only in the renderer. Public
  snapshot media is served from `DATA_DIR/tenants/<tenantId>/media` through the
  renderer-owned `/siab-media/<tenantId>/<filename>` route.
- `SITE_URL` - canonical renderer origin used by Astro metadata/build config.
- `SIAB_RENDERER_FIXTURE_MODE=` - keep empty in production. Fixture mode is
  ignored when `NODE_ENV=production`.

The Astro standalone runtime starts with:

```sh
HOST=0.0.0.0 PORT=4321 node ./dist/server/entry.mjs
```

The Docker image exposes `4321`, runs as the non-root `node` user, and exposes
`GET /healthz` for Docker healthchecks.

The live renderer compose routes the official tenant domain:

- `ami-care.nl`

Before enabling these routes in production, remove or disable any legacy
Traefik routers for the same hosts. `www` aliases are not part of the current
compose rule and require explicit DNS/certificate confirmation before adding a
redirect or host alias.

The production edge proxy must forward the original public host through
`Host` and should also pass `X-Forwarded-Host`. The renderer sends the observed
host to the CMS as `?host=<host>`; the CMS endpoint can also fall back to
`X-Forwarded-Host` or `Host` when called directly. The CMS resolves that host to
an active tenant, then returns only the tenant's active published snapshot.
Draft CMS state is not read by this app.

Published snapshot media refs such as `/api/tenant-media/<tenantId>/<filename>`
and media objects with only a `filename` are rewritten at render time to
`/siab-media/<snapshotTenantId>/<filename>`. The media endpoint checks the
request host's active published snapshot before reading from disk, so one
tenant cannot request another tenant's media through the public renderer.

If the read-only `DATA_DIR` mount is missing a file, `/siab-media` falls back to
the CMS-owned `/api/renderer/media/<tenantId>/<filename>` endpoint using the
same `SIAB_RENDERER_API_TOKEN` boundary as snapshot loading. The CMS endpoint
verifies the tenant media row and streams from the authoritative CMS tenant
media directory, so live media and favicons stay on the CMS media contract
without manual per-tenant copying.

Traefik preserves the original `Host` by default. The current compose template
does not add an explicit `X-Forwarded-Host` middleware; production smoke must
verify the CMS receives the staging host during renderer snapshot lookup.

Aliases configured on CMS `site-settings.aliases` serve the same active tenant
snapshot as the primary tenant domain. The current renderer does not implement
canonical-domain redirects.

Missing or unknown hosts, inactive tenants, missing active snapshots, and
unknown page paths render a `404` response. CMS authentication or validation
failures are treated as deployment/data errors and surface as request failures
instead of falling back to bundled data.

## Local Fixture Mode

For isolated renderer development without a CMS, set:

```sh
SIAB_RENDERER_FIXTURE_MODE=1
```

Fixture mode is ignored when `NODE_ENV=production`. If `SIAB_CMS_URL` is unset
and fixture mode is not explicitly enabled outside production, snapshot loading
fails fast instead of serving the bundled fixture.

## Manual Domain Verification

DNS changes remain an operator/customer task outside the renderer. Before a
snapshot can be activated, a super-admin must verify the tenant domain in the
CMS generation-run snapshot lifecycle panel:

1. Confirm the tenant primary domain and any aliases point at the production
   renderer through Traefik.
2. Confirm Traefik routes those hosts to the renderer service and preserves the
   public `Host` / `X-Forwarded-Host`.
3. Mark `domainVerification.status` as `verified`, or `failed` with notes if
   DNS/proxy checks are not ready.

Activation gates still require the tenant to be non-suspended/non-archived and
`domainVerification.status === "verified"`. Manual activation only bypasses
approval/payment gates; it does not bypass tenant or domain safety gates.
