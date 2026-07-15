# Infra Backlog

This backlog was reset after the monorepo cleanup that removed the command-run
site generation tooling, theme package, generated workflow docs, agent command
artifacts, and the provisional product app shell.

## Current State

- Active platform apps are `apps/cms`, `apps/landing`, `apps/intake`, and
  `apps/renderer`.
- Shared packages are `packages/contracts`, `packages/ui`, and
  `packages/site-renderer`.
- Platform-owned images remain:
  - `ghcr.io/optidigi/siteinabox-cms`
  - `ghcr.io/optidigi/siteinabox-intake`
  - `ghcr.io/optidigi/siteinabox-site`
  - `ghcr.io/optidigi/siteinabox-renderer`
- VPS stack files remain under `/srv/saas/infra/stacks/siteinabox/`.
- Payload tenant data paths remain
  `/srv/data/saas/siab-payload/tenants/<tenantId>`.

## Current Rules

- Do not restore command-run site generation workflows.
- Do not create new per-client source folders, workflows, or images for
  generated sites.
- Future generation must create validated CMS tenant/site/page/theme/SEO data,
  not generated source code.
- DNS/domain, proxy, and tenant Email Sending provisioning must stay inside
  approved application/service automation. Do not restore prompt-runbook
  provisioning flows.
- New app images or deploy contracts require an explicit architecture/deploy
  decision before implementation.

## Open Follow-Up

No current open infra follow-up.

## Implemented Foundation

### 2026-07-15 — Status-monitor tenant inventory

The CMS now exposes a bearer-protected, read-only active-tenant inventory for
the Site in a Box status monitor. Every active tenant produces its canonical
public hostname and paired `admin.<domain>` CMS health endpoint. The monitor
reconciles this full snapshot every minute; inactive, suspended,
archived, deleted, and renamed tenants therefore age out through the status
monitor's two-generation removal safety instead of being reported as outages.
The production VPS inventory timer transports this snapshot every minute; this
avoids ambiguous same-zone Worker subrequests while keeping the CMS authoritative.

### 2026-07-13 — Outbound mail transport correctness

Cloudflare REST and SMTP failures now use provider-specific retry semantics:
HTTP 5xx, 408, and 429 are retryable; ordinary REST 4xx responses are
permanent; SMTP retains transient 4xx and permanent 5xx handling. This keeps
the legal-notification worker from abandoning temporary REST outages or
repeatedly retrying rejected REST requests. Regression tests cover both
protocols. The generation-run quick-send control also consumes the existing
delivery-aware preview action state, showing provider failures instead of
discarding them.

### Phase 9 — Generic renderer activation

**Status:** Foundation added 2026-06-25.

`apps/renderer` now runs as an Astro SSR app using the Node adapter, resolves
the incoming Host header, and loads the active immutable snapshot through the
CMS renderer snapshot endpoint. Local fixture mode is retained only when
`SIAB_RENDERER_FIXTURE_MODE=1` is explicitly set outside production; a missing
CMS URL no longer falls back to bundled data in production. No tenant-specific
deploy artifacts were added.

Follow-up on 2026-06-26 documented the production renderer contract and manual
domain verification workflow. Production requires matching
`SIAB_RENDERER_API_TOKEN` values in CMS and renderer, `SIAB_CMS_URL` in the
renderer, and proxy preservation of the public `Host` / `X-Forwarded-Host`.
Aliases serve the same active snapshot; canonical redirects remain out of
scope. Domain verification remains a super-admin manual checklist on existing
tenant fields, with no DNS automation.

Follow-up on 2026-07-02 added renderer-owned generated-site form ingress at
`POST /api/forms`. The renderer resolves the active snapshot by request host,
injects the snapshot tenant id, normalizes browser form/JSON payloads, and
forwards to CMS Forms. The production renderer router now uses Traefik v3
`HostRegexp` for apex `.nl` tenant domains at low priority so platform-owned
exact routers continue to win. Future non-`.nl` TLD support still needs an
approved routing/certificate automation rule before those domains can be
activated.

Backlog audit on 2026-07-02 confirmed the renderer production deploy contract
is current in `apps/renderer/README.md` and `apps/cms/docs/runbooks/deploy.md`.

### 2026-06-29 — Legacy source cleanup

**Status:** Applied.

Removed obsolete tenant/template source directories from the monorepo. The
current source contract is CMS tenant data plus the platform-owned renderer in
`packages/site-renderer` / `apps/renderer`; deleted tenant-specific source
trees must not be restored.

Production cleanup removed stale renderer staging tenants for
`amicare.optidigi.nl`.

### 2026-07-02 — Infra backlog audit closures

**Status:** Applied.

Confirmed that future tenant provisioning/deploy automation is represented as
product code and approved infra automation through the OpenProvider,
Cloudflare, renderer, and tenant Email Sending service boundaries, not
prompt/runbook command flows.

Confirmed that local MCP declarations are synchronized between the monorepo
root and `apps/cms`.

Confirmed there is no `sites/` source tree in the monorepo. Retired legacy
tenants remain out of scope for the current SIAB tenant roster unless a future
migration is explicitly approved.
