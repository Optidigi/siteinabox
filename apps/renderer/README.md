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
- `SITE_URL` - canonical renderer origin used by Astro metadata/build config.
- `SIAB_RENDERER_FIXTURE_MODE=` - keep empty in production. Fixture mode is
  ignored when `NODE_ENV=production`.

The Astro standalone runtime starts with:

```sh
HOST=0.0.0.0 PORT=4321 node ./dist/server/entry.mjs
```

The Docker image exposes `4321`, runs as the non-root `node` user, and exposes
`GET /healthz` for Docker healthchecks.

The Phase 2 staging compose template routes only:

- `amicare.optidigi.nl`
- `amblast.optidigi.nl`

Do not route `ami-care.nl` or existing legacy Amblast production traffic to the
renderer in this phase.

The production edge proxy must forward the original public host through
`Host` and should also pass `X-Forwarded-Host`. The renderer sends the observed
host to the CMS as `?host=<host>`; the CMS endpoint can also fall back to
`X-Forwarded-Host` or `Host` when called directly. The CMS resolves that host to
an active tenant, then returns only the tenant's active published snapshot.
Draft CMS state is not read by this app.

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
