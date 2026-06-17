# Infrastructure Backlog

CI, deployment, operational, and scaling concerns.

**How this file is used:** Append when CI, deployment, or operational issues are discovered. Move to Closed when resolved. Never delete — lineage matters.

Cross-reference: security findings at `../security/README.md`, product features at `../features/README.md`.

---

## Closed

### OBS-105 — Audit follow-up: production/local runbook drift cleanup

**Status:** Closed 2026-06-05 · **Layer:** infra / docs
**Discovered in:** Session 2026-06-05 (multi-agent codebase tightness audit)

#### Description
The audit found several operational doc mismatches:

- `AGENTS.md` still described tenancy as resolved by `src/middleware.ts`, but
  the app uses the Next 16 `src/proxy.ts` convention.
- The production deploy runbook described copying and running
  `docker-compose.yml` on the VPS, while the current production stack uses
  `/srv/saas/infra/stacks/siab-payload/compose.yml`.
- The form-retention manual purge recipe referenced a `payload` compose service
  and unbundled runtime files that are not present in the production image.
- The local runbook documented the Podman path, but the README/agent quick
  commands did not point operators to it.

#### Resolution
Docs now point tenancy invariants at `src/proxy.ts`, describe copying the repo
compose file to production as `compose.yml`, use the real `siab-payload` service
name for log verification, describe the bundled migrate-on-boot runtime, and
replace the broken manual purge command with an explicit note that no one-off
purge CLI is currently shipped. README/AGENTS now point local operators to the
Podman workflow in `docs/runbooks/local-dev.md` when Docker/Compose is absent.

### OBS-56 — Bring sister SIAB repos forward to current siab-payload contract (post-Phase-D) — RESOLVED

**Status:** Closed 2026-06-01 · **Layer:** multi-repo (`siab-site-template` + `siab-site-orchestrator` + `siab-payload-orchestrator` + per-tenant deploys: `amblast`, `siteinabox`)
**Discovered in:** Session 2026-05-18 (end-of-Phase-D + ami-care deploy)

#### Description
Phase D (zero-authored-CSS migration + RT v2 schema + registry adoption) landed in siab-payload + its production deploy and ami-care.nl was brought up to the new contract this session. The other SIAB sister repos haven't been touched yet and are now behind:

- **`siab-site-template`** — the template every new SIAB tenant site forks from. Likely missing the rt-v2 RtRoot renderer + the `--font-{title,heading,text}` / `--radius-{sm,md,lg}` role token consumer pattern + the `<section id>` anchoring convention. ami-care got these via direct edits on its own fork (commit `c4ca221` and friends); the template needs the same updates so new tenants don't repeat the work.
- **`siab-site-orchestrator`** — orchestrates per-tenant site deploys. Doesn't yet run the cms-editor.css copy step described in OBS-55, so any new tenant site will repeat ami-care's "missing canvas styling" incident.
- **`siab-payload-orchestrator`** — orchestrates siab-payload tenant provisioning. May need updates for the new tenant `siteManifest` field + the rt-v2 schema awareness.
- **Future CMS tenant deploys** — `amblast.com` + `siteinabox.nl` are not CMS-ified yet. They still need to go through `siab-payload-orchestrator` `/add-cms`; do not treat them as already-existing Payload tenants with projection JSON. Their current static site code predates the post-Phase-D contract, so the `/add-cms` conversion must move them off the old contract. Current old-contract characteristics:
  - Rich-text fields as HTML strings instead of RtRoot jsonb
  - Site renderer expecting HTML strings
  - No tenant-theme token consumer wiring
  - No synced `cms-editor.css` artifact path

  After OBS-55 + the template update lands, each tenant needs a normal `/add-cms` run that seeds RtRoot content and `Tenant.siteManifest`, then deploys through the artifact-sync path. They do **not** need the post-rt-v2 repopulate-from-snapshot script unless an interrupted/manual CMS conversion has already created old projection snapshots.

#### Why deferred
End-of-session scope cap. Phase D + ami-care deploy was the priority. The other tenants are still functional on the OLD contract (they render whatever's in their projection JSON; old projection has old-format data which the old renderer handles).

#### Suggested execution order
1. Update `siab-site-template` with: rt-v2 RtRoot renderer, role-token consumer, anchor convention, cms-editor.css entrypoint copy.
2. Update orchestrators to ship those bits to new + existing tenants.
3. Bring Amicare fully onto the artifact-sync path and remove the old site-entrypoint workaround.
4. Run `/add-cms` for amblast first (smaller surface), then siteinabox.
5. Close this entry once all three (amicare ✓ + newly CMS-ified amblast + newly CMS-ified siteinabox) are on the new contract.

#### Related
- OBS-55 (cms-editor.css orchestrator step — feeds into the orchestrator updates above)
- OBS-40 (existing-tenant redeploy after OBS-38 — same shape, different trigger)
- This session's ami-care migration is the reference implementation (see commit history on `site-amicare-zorg` between 2026-05-13 and 2026-05-18)

#### Update — 2026-05-18 (OBS-57 closed)
The structural blocker for OBS-56 is now removed. The sister-repo specs listed in OBS-57's resolution note are the per-repo work items that compose this entry's "Suggested execution order" steps. Close this entry once amicare + amblast + siteinabox are all on the new contract per OBS-57.

#### Update — 2026-05-25
Fresh repo research found this entry was partially stale:
- `siab-site-template` already has RtRoot types/renderers, role font/radius token consumption, block `anchor` fields, and `siteManifest.example.json`.
- `siab-payload-orchestrator` already seeds RtRoot-shaped rich-text blocks and PATCHes `Tenant.siteManifest` from `siteManifest.json` / `siteManifest.example.json`.
- Remaining template-side gaps are narrower: renderer parity hardening, preview anchor propagation, tenant-theme runtime injection, and producing `dist/cms/cms-editor.css` + font assets during build.

The orchestrator side now has a concrete artifact-sync path (see OBS-55 update). Do not copy the old `/data:rw` site-entrypoint workaround into more templates/sites. The next implementation batch should bring `siab-site-template` to the same artifact contract, then migrate/redeploy `amblast` and `siteinabox`.

Follow-up same session: `siab-site-template` was brought forward to the new artifact contract. Its build now runs `scripts/build-cms-css.mjs` and produces `dist/cms/cms-editor.css` plus `dist/cms/files/`; a `dev:cms-css` watcher writes the same bundle into a local Payload tenant data dir. `BaseLayout.astro` now injects `tenant-theme.css` from `CMS_DATA_DIR` when present, `RtNodeRenderer` is hardened with RtRoot guarding / inline rendering / external-link rel handling / text extraction, and `PreviewIsland` passes `block.anchor` through every block renderer. Validation: `pnpm exec astro check` passed with existing warnings/hints, `pnpm test` passed, and `pnpm build` produced `dist/cms/cms-editor.css`.

Correction from operator: `amblast` and `siteinabox` are not CMS-ified yet. They should be treated as future `/add-cms` conversions, not existing tenant redeploys. Same-session Amicare follow-up removed the old Docker entrypoint CSS-copy workaround from `site-amicare-zorg`, added an Amicare-specific `siteManifest.json`, updated the VPS compose/example docs to use `/data:ro` plus `sync-cms-artifacts.sh`, and updated `scripts/restructure-cms.sh` to emit RtRoot JSON with explicit block anchors. Validation in `site-amicare-zorg`: `pnpm build` passed and produced `dist/cms/cms-editor.css` plus font files, `pnpm astro check` passed with existing hints, `bash -n scripts/restructure-cms.sh` passed, and a mocked run of `scripts/restructure-cms.sh` produced the expected 5-block payload.

Production follow-up completed the Amicare rollout on the artifact-sync path: `site-amicare-zorg` image `c9eb3ce` was built by GitHub Actions, the VPS copied `/app/dist/cms/*` into `/srv/data/saas/siab-payload/tenants/7/`, the live compose mount is `/data:ro`, the `ami-care` container is healthy, `https://ami-care.nl` and `/healthz` return 200/`ok`, `Tenant.siteManifest` is populated for tenant 7, and the live page renders explicit anchors `top`, `werkwijze`, `over`, `wat-telt`, and `contact`.

Follow-up 2026-05-26: `site-amicare-zorg` now consumes the supported CMS site settings in the live shell: uploaded logo, favicon, maintenance banner, footer text, and footer copyright. The footer keeps the original Amicare fallback tagline when no CMS footer text is set, so enabling settings support no longer changes the default live footer copy. Same-day correction added supported business identifiers (`nap.kvkNumber`, `nap.establishmentNumber`) to Payload settings/projection and Amicare consumption, with Amicare retaining its exact legacy footer fallbacks (`Handelsnaam: AMICARE ZORG`, `KVK 99968347`, `Vestigingsnr. 000065004922`) until those values are stored in CMS.

Same-day maintenance-banner correction: the banner is now a theme-owned optional
component, not generic layout markup. `site-amicare-zorg` provides
`src/components/MaintenanceBanner.astro`; its layout loads that component only
when `site.maintenance.enabled` is true. `siab-site-template` and the
`siab-payload-orchestrator` converter/reviewer guidance now use the same
optional lookup contract, so themes without `MaintenanceBanner.astro` no-op.

The future `amblast` and `siteinabox` `/add-cms` runs are manual operator workflow runs, not remaining repo code or config blockers for this item.

#### Research verification — 2026-05-28
Current `siab-payload` has the payload-side contract pieces needed by this
entry. No additional `siab-payload` code change was identified by the backlog
audit. The remaining `amblast` and `siteinabox` `/add-cms` work is a manual
operator workflow run, not unresolved repo code/config work.

#### Current verification — 2026-05-28
Still current and narrowly scoped. `siab-payload` itself does not need another
payload-side contract change for this item. Remaining `amblast` and
`siteinabox` CMS work is a future manual orchestrator invocation, not an active
repo-code backlog blocker.

#### Update — 2026-06-01
Codex enablement was added to both orchestrators without removing or rewriting
their Claude workflow files. `siab-site-orchestrator` and
`siab-payload-orchestrator` now each have a root `AGENTS.md`, `.codex/`
command entrypoints, Codex phase-agent mirrors, Codex settings, and MCP mirror
files. The Codex startup path now routes `/new-site` and `/add-cms <slug>` into
the same `preflight.md` confirmation gate, `prompt.md` runbook, and existing
Claude phase-agent contracts. Local container checks in the Codex path are
documented to use `podman`; GitHub Actions and VPS deployment contracts remain
Docker-compatible where those runtimes are part of the external system.
Follow-up smoke tests used `codex exec` in read-only ephemeral mode from both
orchestrator roots and confirmed the startup behavior: `/new-site` and
`/add-cms amblast` both stop at the `preflight.md` summary/confirmation gate
and do not open `prompt.md` early. The Codex enablement subtask is complete. With no remaining code or config
changes required, OBS-56 is closed; future `amblast` and `siteinabox`
`/add-cms` conversions should be started manually when the operator is ready.


### OBS-76 — GitHub push events no longer materialize Actions image builds

**Status:** Closed 2026-05-26 · **Layer:** infra (GitHub Actions / GHCR)
**Discovered in:** Session 2026-05-26 (theme-owned maintenance banner rollout)

#### Description
Pushing `site-amicare-zorg` commit `b8b16e7` to `main` did not create a new
`Build and publish image` GitHub Actions run. A manual `gh workflow run` attempt
returned GitHub API HTTP 500. Production was kept moving by building the image
directly on the VPS and recreating `ami-care` from local image tag
`ghcr.io/optidigi/site-amicare-zorg:sha-b8b16e7`.

Attempting to push that VPS-built image back to GHCR failed because the
available GitHub token lacked the expected package-write scope. The temporary
VPS Docker login was immediately logged out and `~/.docker/config.json` now has
an empty `auths` object.

Follow-up investigation the same day narrowed this away from VPS compose drift:
production compose files under `/srv` still point at GHCR images in the normal
way, and no repo clones remain under `/tmp`. GitHub records PushEvents for new
commits in `site-amicare-zorg`, `siab-payload`, and `siab-site-template`, but no
new Actions runs or check suites are created after the earlier successful runs.
Direct `workflow_dispatch` calls for `site-amicare-zorg` return GitHub API HTTP
500. Updating the Amicare workflow file to force Node 24 action runtime and
pushing again still did not create a run.

Additional repo-local attempts did not fix it: disabling/enabling the workflow
through the Actions API returned 204 but did not restore run creation; adding a
temporary `repository_dispatch` trigger and dispatching it returned 204 but did
not create a run; creating a brand-new `publish-image.yml` workflow and pushing
it also did not create a run. Those diagnostic workflow changes were reverted.
Inspecting org-level Actions policy or pushing GHCR manually requires
`admin:org` / `write:packages`; the currently available GitHub CLI token does
not have those scopes.

Research update 2026-05-26: this is a GitHub Actions service incident, not a
repo-local workflow/config regression. GitHub still records PushEvents for
affected commits, but creates no check suites or workflow runs after the last
known-good run window. Evidence:

- `site-amicare-zorg`: `3a227c2` created a successful image run at
  2026-05-26 10:16 UTC; later main commits `b8b16e7`, `fa322e4`, `e3e626a`,
  `418b227`, `93cf537`, and `93f2fca` have zero check suites.
- `siab-site-template`: `3dec474` created a successful publish run at
  2026-05-25 20:11 UTC; the 2026-05-26 10:47 UTC push to `d3992ee` has zero
  check suites.
- `siab-payload`: push-triggered runs still materialized at 2026-05-26
  10:20 UTC (`fa03334`), but later PushEvents after 10:47 UTC did not create
  visible runs in the current API results.
- Repo-level Actions permissions are enabled and workflows remain active for
  affected repos. Push actor and commit metadata are normal `shimmy-aga`
  pushes, not `github-actions[bot]` / `GITHUB_TOKEN` recursive-trigger
  suppression.
- GitHub Status reports a current "Incident with Actions and Pages" with
  Actions moved to major outage at 2026-05-26 11:19 UTC
  (`https://stspg.io/6gzfzr1dx684`).

Keep this item active until GitHub marks Actions recovered, then retrigger the
missed image/publish workflows and verify fresh GHCR tags exist for the current
heads before resuming normal VPS pull/recreate deploys.

Resolution 2026-05-26: GitHub Actions recovered for the affected repos. A fresh
`siab-payload` push (`fb6f166`) created both `ci` and `build-image` runs; both
passed, the GHCR image was smoke-started by CI, and the VPS pulled/recreated
`siab-payload` from revision `fb6f16628c5879d02846a6260ca23638fe862093`.
Current-head missed workflows were also rerun successfully for
`siab-site-template` (`6348286`, `publish`) and `site-amicare-zorg` (`a1dbb56`,
`Build and publish image`). Amicare CMS artifacts were resynced from the new
site image into `/srv/data/saas/siab-payload/tenants/7`, the `ami-care`
container was recreated from revision
`a1dbb560de8571a8d46259a402676fb292fe5e65`, and both public health endpoints
returned HTTP 200.

#### Suggested fix shape
1. Monitor the GitHub Status incident until Actions is back to operational.
2. Retrigger missed workflows for the current heads (manual `workflow_dispatch`
   if available, or a small follow-up push if dispatch still fails).
3. Verify the standard path is restored: push to `main` creates an Actions run,
   the workflow publishes GHCR `latest` and `sha-*`, and VPS deploys can pull
   the image.
4. Once GHCR is updated for the current Amicare/Payload/template heads and a
   normal pull/recreate deploy works where needed, close this item.

---

## Active

### OBS-121 — Verify and retire obsolete `optidigi/design-systems` registry infrastructure

**Status:** Closed 2026-06-16 · **Layer:** infra / multi-repo cleanup / frontend architecture
**Discovered in:** Session 2026-06-15 (SIAB registry deprecation follow-up)

#### Purpose
Retire the separate `optidigi/design-systems` registry repo and production
registry service if they are still confirmed obsolete. The current frontend
direction is that SIAB apps own their local shadcn-style primitives and custom
components, then later extract shared frontend into monorepo packages such as
`packages/ui`, `packages/site-blocks`, or `packages/site-contracts` when the
broader SIAB monorepo exists.

Do not remove the repo, GHCR image, VPS service, or `registries.optidigi.nl`
route until obsoleteness is freshly verified across all relevant codebases and
production.

#### Current known state
As of the 2026-06-15 planning sessions:

- `siab-payload` has moved away from the private `@siab/*` registry as the
  authoring source.
- Custom CMS/editor composites have been moved out of `src/components/ui`.
- `src/components/ui` is intended to be local upstream-name shadcn primitives,
  not app-specific registry-owned code.
- `OBS-118` tracks future shared frontend extraction into monorepo packages.
- `OBS-119` tracks the broader SIAB platform monorepo migration.
- Production still has a `design-systems` container and
  `registries.optidigi.nl -> design-systems:80` route.

#### Required obsoleteness verification
Before removing anything, run a fresh verification pass:

1. Search every relevant SIAB repo for `@siab`, `registries.optidigi.nl`,
   `design-systems`, `registry:check`, and shadcn registry references.
2. Confirm `siab-payload` no longer depends on live `registries.optidigi.nl`
   during install, CI, typecheck, deploy, or local development.
3. Confirm `siab-site-template`, generated site repos, orchestrators,
   `site-siteinabox`, `site-amblast`, and `site-amicare-zorg` do not consume
   registry items from `design-systems`.
4. Confirm no CI workflow in any relevant repo still builds, publishes, pulls,
   or drift-checks `@siab/*` registry artifacts.
5. Inspect the VPS current state: running containers, NPM/Traefik routes,
   GHCR image usage, and any stack files under `/srv` referencing
   `design-systems` or `registries.optidigi.nl`.
6. Confirm no external/non-SIAB consumer still needs the public registry URL.
7. Update this backlog item with the fresh verification results before removal.

#### Suggested removal shape
If obsoleteness is confirmed:

1. Remove or archive the `design-systems` production stack from VPS infra.
2. Remove the `registries.optidigi.nl` proxy route from the active edge router
   (NPM or Traefik, depending on current state).
3. Stop and remove the `design-systems` container from production.
4. Decide whether to archive the GitHub repository, leave it read-only, or keep
   it as historical reference until the SIAB monorepo is complete.
5. Remove stale docs/scripts/CI references in active SIAB repos.
6. Ensure `OBS-118` remains the forward path for any shared frontend code that
   still needs package extraction.

#### Acceptance criteria
1. Fresh verification confirms no active SIAB codebase, CI workflow, production
   deploy path, or external consumer depends on `design-systems`.
2. `registries.optidigi.nl` is either removed or intentionally repointed with a
   documented reason.
3. Production no longer runs an obsolete `design-systems` container.
4. Active docs no longer describe the private registry as the SIAB frontend
   source of truth.
5. Historical backlog entries remain intact for lineage, but current runbooks
   point at local shadcn primitives and future monorepo packages instead.

#### Resolution — 2026-06-16
Fresh verification confirmed the separate `optidigi/design-systems` registry is
obsolete for active SIAB work and the VPS registry service was retired.

Local cloned repo scans covered `siab-payload`, `siab-site-template`,
`site-amicare-zorg`, `siab-site-orchestrator`, `siab-payload-orchestrator`, and
the duplicate local `cms-orchestrator` checkout. Shallow GitHub clones under
`/tmp/obs121-scan` covered `site-siteinabox`, `site-amblast`,
`siab-site-themes`, `serverinfra-ops`, and `serverinfra-prod`. Searches for
`@siab`, `registries.optidigi.nl`, `design-systems`, `registry:check`,
`registry.json`, and shadcn registry references found no active consumer,
install, CI, or deploy dependency. `siab-payload` no longer has a
`registry:check` package script or workflow reference; remaining
`design-systems` / `@siab` matches in this repo are historical backlog/audit
lineage or current local-shadcn guidance.

GitHub code search with the authenticated CLI found no active `@siab/` code
matches across `Optidigi`; `registry:check`, `registries.optidigi.nl`, and
`design-systems` matches were limited to historical `siab-payload` backlog and
audit text. The production `design-systems` access log still showed a historical
batch of `shadcn` registry pulls on 2026-06-11, plus unrelated internet scanner
traffic, but no current codebase or production stack still referenced it.

Production VPS cleanup completed over `ssh prod`:

- NPM proxy host `23` for `registries.optidigi.nl -> design-systems:80` was
  disabled and soft-deleted in NPM's SQLite database.
- NPM certificate `37` for `registries.optidigi.nl` was soft-deleted; the
  generated proxy config and Let's Encrypt renewal/live/archive files for
  `npm-37` were removed.
- NPM config validated with `nginx -t` and was reloaded successfully.
- `/srv/ops/infra/stacks/design-system` was removed after
  `docker compose down`.
- The running `design-systems` container was stopped and removed.
- Stale `ghcr.io/optidigi/design-systems:latest` and `latest-manual` images
  were removed from the VPS.

Backups were kept before removal:

- Stack backup:
  `/home/serveradmin/obs121-design-systems-retire-20260616T075947Z/`
- NPM DB/proxy config backup:
  `/srv/data/ops/nginx-proxy-manager/data/obs121-design-systems-retire-20260616T075947Z/`
- NPM cert backup:
  `/srv/data/ops/nginx-proxy-manager/data/obs121-cert-retire-20260616T080231Z/`

Final VPS verification found no running `design-systems` container, no
`ghcr.io/optidigi/design-systems` image, no active stack directory, and no
active stack file references under `/srv/ops/infra/stacks`,
`/srv/prod/infra/stacks`, or `/srv/saas/infra/stacks`. NPM now records proxy
host `23` as `enabled=0, is_deleted=1` and certificate `37` as `is_deleted=1`.
`https://registries.optidigi.nl/` now returns Cloudflare `525` because the VPS
edge route/certificate is gone; the Cloudflare DNS record itself was not changed
as part of this server/VPS cleanup. Spot checks after NPM reload returned `200`
for `https://admin.siteinabox.nl/api/health`, `https://siteinabox.nl/`,
`https://ami-care.nl/healthz`, and `https://admin.ami-care.nl/api/health`.

Follow-up same session: the local checkout at
`/home/shimmy/Desktop/env/siab/design-systems` and temporary verification clones
under `/tmp/obs121-scan` were removed. The GitHub repository
`Optidigi/design-systems` was archived. A direct GitHub repo deletion attempt
was rejected by GitHub because the current token lacks `delete_repo`; deleting
the remote repository entirely requires refreshing an owner/admin credential
with that scope.

### OBS-120 — Replace Nginx Proxy Manager with Traefik using canonical Docker-label routing

**Status:** Completed 2026-06-16 · **Layer:** infra / edge routing / SIAB site generation
**Discovered in:** Session 2026-06-15 (VPS edge-routing migration research)

#### Purpose
Migrate the VPS edge proxy from Nginx Proxy Manager (NPM) to Traefik, using one
uniform Docker-label routing convention for every public app, service, and
generated SIAB site. The goal is not just to swap proxies; it is to make routing
canonical, local to each deployable container, and easy for future SIAB site
generation/provisioning to emit automatically.

Downtime is acceptable for this migration. Do not run NPM and Traefik in
parallel as the long-term shape.

#### Current production shape observed 2026-06-15
Read-only VPS research over `ssh prod` found:

- NPM is the current edge process and binds host ports `80`, `81`, and `443`.
- Public containers already join the shared Docker network `proxy`, which is
  the right network for Traefik's Docker provider.
- Most services are only exposed on Docker-internal ports, not host-published.
- NPM proxy host config lives under
  `/srv/data/ops/nginx-proxy-manager/data/nginx/proxy_host/`.
- NPM data/certs live under `/srv/data/ops/nginx-proxy-manager/`.
- `/srv/prod/infra/scripts/register_npm.sh` is NPM-specific and creates/updates
  proxy hosts through NPM's API.

Current NPM host map:

```txt
vault.optidigi.nl               -> vaultwarden:80
insignia.optidigi.nl            -> insignia-app:3000
insignia-custom.optidigi.nl     -> insignia-custom-app:3000
insignia-stitchs.optidigi.nl    -> insignia-stitchs-app:3000
insignia-superfunny.optidigi.nl -> insignia-superfunny-app:3000
ami-care.nl                     -> ami-care:4321
admin.siteinabox.nl             -> siab-payload:3000
admin.ami-care.nl               -> siab-payload:3000
amblast.siteinabox.nl           -> amblast:80
siteinabox.nl                   -> siteinabox:80
backlog.optidigi.nl             -> overzicht:80
dash.optidigi.nl                -> dashboard:80
automations.optidigi.nl         -> automations:5678
openweb.optidigi.nl             -> open-webui:8080
status.optidigi.nl              -> status-monitor:3001
npm.optidigi.nl                 -> nginx-proxy-manager:81
cdn.optidigi.nl                 -> cdn:80
```

`registries.optidigi.nl -> design-systems:80` was retired in OBS-121 on
2026-06-16 and is no longer part of the active NPM host map.

NPM also has a global custom server proxy snippet that adds permissive CORS
headers:

```txt
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: *
```

Do not blindly preserve that globally. Port it as an explicit Traefik middleware
only for services that actually need it.

#### Settled implementation shape
Use Traefik's Docker provider with explicit opt-in labels on each public
service. Do not use a central route manifest for normal apps/sites. Keep
Traefik's own config minimal and global:

```txt
/srv/ops/infra/stacks/traefik/
  compose.yaml

/srv/data/ops/traefik/
  acme/acme.json
```

Traefik stack responsibilities:

- Bind host `80` and `443`.
- Enable Docker provider.
- Set `providers.docker.exposedByDefault=false`.
- Set `providers.docker.network=proxy`.
- Configure `web` and `websecure` entrypoints.
- Redirect HTTP to HTTPS.
- Use Traefik-managed Let's Encrypt ACME storage.
- Expose the Traefik dashboard on a new host such as `traefik.optidigi.nl`.

Each public app/site compose declares its own route with labels:

```yaml
labels:
  - traefik.enable=true
  - traefik.docker.network=proxy
  - traefik.http.routers.<id>.rule=Host(`<domain>`)
  - traefik.http.routers.<id>.entrypoints=websecure
  - traefik.http.routers.<id>.tls.certresolver=letsencrypt
  - traefik.http.services.<id>.loadbalancer.server.port=<internal-port>
```

For SIAB generated sites, the site generation/provisioning output should emit
the final compose file with these labels. There should be no separate manual
proxy-registration step for generated sites once this model is in place.

Example generated-site route contract:

```txt
site slug        -> router/service label id
primary domain   -> Host(...) rule
aliases          -> additional Host(...) values
internal port    -> loadbalancer.server.port
middlewares      -> optional explicit middleware labels/references
```

#### SIAB-specific routing notes
Current SIAB labels should preserve:

```txt
siteinabox.nl          -> siteinabox:80
admin.siteinabox.nl    -> siab-payload:3000
admin.ami-care.nl      -> siab-payload:3000
ami-care.nl            -> ami-care:4321
amblast.siteinabox.nl  -> amblast:80
```

`siab-payload` tenancy depends on the `Host` header. Traefik normally forwards
the original host, so the current tenant/admin host logic should continue to
work, but this must be smoke-tested explicitly.

For tenant admin hosts, start explicit during migration:

```txt
Host(`admin.siteinabox.nl`) || Host(`admin.ami-care.nl`)
```

Later, when SIAB provisioning becomes programmatic, decide whether tenant admin
hosts are appended to the CMS route labels during provisioning or handled by a
controlled wildcard/admin-host rule plus existing `siab-payload` host
validation.

#### Required fresh-research gate before implementation
Before implementation, re-check the VPS state and Traefik's current docs. Do not
trust the 2026-06-15 snapshot if the VPS changed.

Required confirmation pass:

1. Re-read `/srv/ops/infra/stacks`, `/srv/prod/infra/stacks`, and
   `/srv/saas/infra/stacks`.
2. Re-list running containers, networks, published ports, labels, and mounts.
3. Re-export the active NPM route map or the then-current edge route map.
4. Confirm whether the edge is still NPM or already partly migrated.
5. Confirm current SIAB domains and tenant-admin hosts.
6. Confirm which services actually need permissive CORS headers.
7. Confirm Let's Encrypt strategy and rate-limit risk before replacing certs.

#### TL;DR implementation plan
1. Create `/srv/ops/infra/stacks/traefik/compose.yaml` and
   `/srv/data/ops/traefik/acme/acme.json` with correct permissions.
2. Add canonical Traefik labels to every public compose stack.
3. Replace NPM-specific comments/docs in compose files with proxy-neutral or
   Traefik-specific wording.
4. Retire or replace `/srv/prod/infra/scripts/register_npm.sh`. Future SIAB
   site generation should write compose labels instead of calling an edge API.
5. Stop NPM and free host ports `80/443`.
6. Start Traefik.
7. Let Traefik issue fresh certificates.
8. Smoke-test every public host, with extra checks for `siab-payload` host
   tenancy, SIAB tenant admin hosts, `ami-care` CMS-backed preview/runtime,
   OnlyOffice, n8n, Vaultwarden, CDN, and Uptime Kuma.
9. Keep NPM data and certs on disk for rollback until Traefik has been stable
   for a defined period.

#### Acceptance criteria
1. NPM no longer runs or owns host ports `80/443`.
2. Traefik is the only production edge proxy and is managed by compose.
3. Every public app/site declares routing through the same Docker-label pattern.
4. All current public hostnames return the expected app and valid TLS.
5. SIAB generated-site deploy docs/templates emit Traefik labels as the
   canonical route declaration.
6. `register_npm.sh` is removed, replaced, or documented obsolete.
7. CORS/header behavior is explicit per service, not a hidden global NPM
   snippet.
8. Rollback notes exist until the old NPM data can be safely archived.

#### Completion notes — 2026-06-16
Implemented on the VPS over `ssh prod`.

- Created `/srv/ops/infra/stacks/traefik/compose.yaml` and
  `/srv/data/ops/traefik/acme/acme.json`.
- Started Traefik as the only live edge process on host ports `80` and `443`;
  `nginx-proxy-manager` is stopped and no longer binds public ports.
- Used `traefik:v3.6`. Initial `v3.4`/`v3.5` tests failed to initialize the
  Docker provider against the VPS Docker API with an old client API version;
  `v3.6` connected successfully.
- Added explicit Traefik labels to all public compose stacks under
  `/srv/ops/infra/stacks`, `/srv/prod/infra/stacks`,
  `/srv/saas/infra/stacks`, plus the live `/srv/temp/overzicht` stack.
- Exposed the Traefik dashboard at `status.optidigi.nl`, protected with
  BasicAuth. The earlier `traefik.optidigi.nl` dashboard hostname was removed
  and now returns the edge default `404`.
- Replaced the old global NPM CORS behavior with an explicit Traefik
  `cors-assets` middleware on `cdn.optidigi.nl`.
- Removed `/srv/prod/infra/scripts/register_npm.sh`; future routing changes
  are made by updating compose labels.
- Updated this repo's production compose template and deploy runbook so SIAB
  admin routing is expressed as Traefik labels.
- After Traefik health was confirmed, removed the obsolete NPM container, stack
  directory, data/cert directories, and registration-helper backup:
  `/srv/ops/infra/stacks/nginx-proxy-manager`,
  `/srv/data/ops/nginx-proxy-manager`, `/srv/data/ops/npm`,
  `/srv/prod/infra/scripts/register_npm.sh`, and
  `/srv/prod/infra/scripts/register_npm.sh.obsolete-obs120-20260616`.
- Removed `npm.optidigi.nl` from the Traefik dashboard router. It no longer
  routes to any service at the VPS edge. DNS is covered by the intentional
  `*.optidigi.nl` wildcard, so there is no per-host Cloudflare record to
  delete.
- Removed Uptime Kuma from the VPS after monitoring was consolidated elsewhere:
  stopped and removed the `status-monitor` container, deleted
  `/srv/ops/infra/stacks/uptime-kuma`, `/srv/data/ops/uptime-kuma`,
  `/srv/data/ops/kuma`, and `/srv/prod/infra/scripts/register_kuma.sh`.
  `status.optidigi.nl` was then reused for the BasicAuth-protected Traefik
  dashboard.
- Confirmed the managed live compose files all carry explicit Traefik labels,
  so normal `docker compose pull && docker compose up -d` redeploys preserve
  routing:
  `/srv/ops/infra/stacks/{cdn,n8n,onlyoffice,open-webui,traefik,vaultwarden}`,
  `/srv/prod/infra/stacks/{amblast,ami-care,siteinabox}`,
  `/srv/saas/infra/stacks/{insignia,insignia-custom,insignia-stitchs,insignia-superfunny,siab-payload}`,
  and `/srv/temp/overzicht`.
- Removed the CDN `image-processor` host publish
  `127.0.0.1:8089:8080`. It was only a loopback shortcut; public CDN panel and
  health traffic already flow through Traefik to `cdn`, and nginx proxies
  `/panel/` and `/health` to `image-processor:8080` over the Docker network.
  After removing the host publish, `image-processor` stayed healthy and
  `https://cdn.optidigi.nl/`, `/panel/`, and `/health` returned `200`.

Backups for rollback are in:

```txt
/home/serveradmin/obs120-traefik-migration-20260616T084316Z
/home/serveradmin/obs120-traefik-migration-latest
```

The backups include the prior ops/prod/saas stack files, the live
`/srv/temp/overzicht/compose.yml`, an NPM data/Let's Encrypt tarball, and the
exported NPM proxy-host map. These are historical migration backups only; the
live NPM stack/data paths were removed after Traefik was confirmed healthy.

Post-cutover smoke checks returned before the later Uptime Kuma retirement and
dashboard hostname change:

```txt
200 https://vault.optidigi.nl/
200 https://insignia.optidigi.nl/api/health
200 https://insignia-custom.optidigi.nl/api/health
200 https://insignia-stitchs.optidigi.nl/api/health
200 https://insignia-superfunny.optidigi.nl/api/health
200 https://ami-care.nl/healthz
200 https://admin.siteinabox.nl/api/health
200 https://admin.ami-care.nl/api/health
200 https://amblast.siteinabox.nl/
200 https://siteinabox.nl/
404 https://backlog.optidigi.nl/
200 https://dash.optidigi.nl/
200 https://automations.optidigi.nl/
200 https://openweb.optidigi.nl/
200 https://status.optidigi.nl/
200 https://cdn.optidigi.nl/
```

Current dashboard-host smoke checks after Uptime Kuma retirement:

```txt
401 https://status.optidigi.nl/
404 https://traefik.optidigi.nl/
404 https://npm.optidigi.nl/
```

`backlog.optidigi.nl` returned `404` at `/` before and after migration, so that
is treated as the expected root-path behavior for the current app.

### OBS-122 — Confirm wildcard DNS covers retired VPS hostnames

**Status:** Closed 2026-06-16 · obsolete; wildcard DNS intentionally covers VPS hostnames · **Layer:** infra / DNS cleanup
**Discovered in:** Session 2026-06-16 (post-Traefik VPS cleanup)

#### Context
The initial post-cleanup assumption was that `npm.optidigi.nl` and
`status.optidigi.nl` had individual stale Cloudflare records. The actual DNS
shape is a wildcard route for `*.optidigi.nl` pointing at the VPS, so there are
no per-host records to delete.

After OBS-120, the VPS no longer serves the retired NPM hostname, and
`status.optidigi.nl` was repurposed for the Traefik dashboard:

```txt
npm.optidigi.nl     -> Traefik edge default 404
status.optidigi.nl  -> Traefik dashboard, BasicAuth protected
```

The corresponding NPM and Uptime Kuma containers, stack directories, data
directories, certificates, and registration helper scripts have been removed
from the VPS. Traefik is the only edge process on ports `80/443`.

### OBS-119 — Consolidate SIAB repos into a platform monorepo and preserve the current prod deployment model

**Status:** Closed 2026-06-16 · **Layer:** infra / multi-repo platform architecture
**Discovered in:** Session 2026-06-15 (SIAB platform monorepo planning)

#### Purpose
Consolidate the SIAB codebases into a single `siteinabox` monorepo without
turning `siab-payload` into the owner of every surface. The monorepo should make
ownership explicit, keep deployable apps isolated, and prepare the current
AI/runbook orchestrators to become a programmatic platform service later.

#### Settled implementation shape
The target platform layout is:

```txt
siteinabox/
  apps/
    cms/              # current siab-payload
    site/             # current site-siteinabox public marketing/funnel entry
    intake/           # customer-facing wizard + generated lead preview

  packages/
    site-template/    # current siab-site-template generated-site baseline
    site-contracts/   # manifest, block, theme, intake/provisioning schemas
    site-runtime/     # generated-site runtime helpers
    site-blocks/      # shared generated-site block renderers
    site-themes/      # current siab-site-themes, made real
    ui/               # future shared app UI only when duplication proves it
    tools/
      siab-orchestrator/

  sites/              # intended generated/client site source home
  docs/
```

Product/deployment ownership decisions:

- Public SIAB marketing stays separate from CMS and owns the funnel entry.
- Intake is a separate app surface because it is wizard-like and service-backed
  (KvK/API calls, form state, proposal generation, generated lead preview).
- The lead preview belongs to the intake app. It is a single generated canvas
  page with only the small theme toolbar available: radius, color palette, and
  font family.
- CMS preview remains the existing Payload-token plus generated-site runtime
  flow. `siab-payload` mints preview tokens; tenant/generated Astro sites render
  the preview route.
- `site-template`, generated tenant sites, and theme packages stay separate
  from CMS ownership.
- Orchestrators are packages/tools for now. Later, their responsibilities
  should move into a programmatic `platform-worker` / orchestration service.
- `optidigi/design-systems` does not come forward as an active authoring source
  unless a new distribution-only need is explicitly decided.

#### Current production shape observed 2026-06-15
Research over `ssh prod` found the current VPS already follows the desired
runtime model:

```txt
/srv/prod/infra/stacks/
  siteinabox/         -> ghcr.io/optidigi/site-siteinabox:latest
  amblast/            -> ghcr.io/optidigi/site-amblast:latest
  ami-care/           -> ghcr.io/optidigi/site-amicare-zorg:latest

/srv/saas/infra/stacks/
  siab-payload/       -> ghcr.io/optidigi/siab-payload:latest + Postgres

/srv/data/saas/siab-payload/
  tenants/7/          -> Ami-Care CMS artifacts mounted read-only by ami-care
```

Traefik currently routes by hostname on the shared `proxy` Docker network using
compose labels:

```txt
siteinabox.nl          -> siteinabox:80
admin.siteinabox.nl    -> siab-payload:3000
ami-care.nl            -> ami-care:4321
admin.ami-care.nl      -> siab-payload:3000
amblast.siteinabox.nl  -> amblast:80
```

The current generated-site/CMS artifact model should be preserved: CMS-backed
tenant sites mount `/srv/data/saas/siab-payload/tenants/<id>` read-only and
render from exported artifacts.

#### Required fresh-research gate before implementation
Before starting implementation, re-read/research every relevant codebase and the
production server again. Do not rely on the 2026-06-15 snapshot because the VPS
and routing layer may have changed, for example from Nginx Proxy Manager to
Traefik.

Required confirmation pass:

1. Inspect current local/GitHub repos for `siab-payload`, `site-siteinabox`,
   `siab-site-template`, `siab-site-themes`, `site-amicare-zorg`,
   `site-amblast`, `siab-site-orchestrator`, and
   `siab-payload-orchestrator`.
2. Inspect current production paths under `/srv`, especially infra stacks,
   compose files, app containers, images, volumes, networks, and routing config.
3. Confirm the current edge router and route model before choosing
   `siteinabox.nl/start`, `start.siteinabox.nl`, or another intake route.
4. Confirm current tenant artifact directories and CMS-backed site mounts before
   migrating generated-site/runtime contracts.
5. Update this backlog item with the new research snapshot before moving files.

#### Update — 2026-06-16 (Traefik compatibility pickup)
Fresh compatibility work after the VPS edge migration confirmed the production
runtime model is now Traefik-first and repo/runbook language needs to treat
Docker labels as the canonical routing declaration.

Read-only VPS verification over `ssh prod` found `traefik:v3.6` is the only
container binding host ports `80` and `443`. Current SIAB public containers
(`siteinabox`, `amblast`, `ami-care`, and `siab-payload`) expose only internal
container ports and are routed through compose labels on the shared `proxy`
network. Tenant artifact state is still the expected read-only generated-site
model under `/srv/data/saas/siab-payload/tenants/7/`, including
`cms-editor.css`, `tenant-theme.css`, `manifest.json`, `site.json`, `pages/`,
`media/`, and `files/`. Live stack greps also found a few stale comments in
production compose files that still mention NPM, but the active routing labels
are Traefik.

Repo scan covered local checkouts for `siab-payload`, `siab-site-template`,
`site-amicare-zorg`, `siab-site-orchestrator`, and
`siab-payload-orchestrator`, plus fresh shallow GitHub clones for
`site-siteinabox`, `site-amblast`, and `siab-site-themes` under
`/tmp/obs119-scan`. The public site and themes repos did not contain active
NPM/register helper references. `siab-payload` was already Traefik-aware in
`docker-compose.yml`, `docs/runbooks/deploy.md`, and the tenant provisioning
UI copy.

Same-session changes:

- `site-amicare-zorg` production compose now declares the `ami-care.nl` Traefik
  router/service labels, uses `proxy` as the default external network name, and
  no longer documents Nginx Proxy Manager as the edge proxy. Preview/CSP/SEO
  comments now refer to Traefik or generic reverse-proxy behavior.
- `siab-site-orchestrator` AGENTS/Claude/preflight docs now describe VPS
  compose plus Traefik route labels as the out-of-scope operational boundary
  instead of "nginx vhost".
- `siab-payload-orchestrator` AGENTS/Claude/preflight docs now use the same
  Traefik wording. Its Phase 9 `/add-cms` compose snippet now includes the
  shared `proxy` network and explicit Traefik labels for the generated SSR site
  instead of leaving routing as an operator-invented follow-up.

Validation: `pnpm build` passed in `site-amicare-zorg` and regenerated
`dist/cms/cms-editor.css`. Focused `rg` checks confirmed the new Amicare compose
labels and `/add-cms` Traefik snippet are present. No TS/JS files changed in
`siab-payload` during this pickup, so this repo's typecheck was not required.

#### Update — 2026-06-16 (orchestrator consolidation assessment)
Research compared the current `siab-site-orchestrator` and
`siab-payload-orchestrator` contracts, command entrypoints, phase prompts,
agent specs, helper scripts, and repo setup.

Conclusion: consolidating the two orchestrator repositories into one main
orchestrator surface is reasonable, but merging the two workflows into one
linear runbook would be a regression risk. The safe target is one
orchestrator package/repo with two explicit subcommands, `/new-site` and
`/add-cms <slug>`, each keeping its own preflight, confirmation gates, phase
agents, and writable-surface rules.

Why this shape fits:

- The duplicated shell is substantial: both repos carry parallel `AGENTS.md`,
  `CLAUDE.md`, `.codex/commands`, `.codex/agents`, `.claude/commands`,
  `.claude/agents`, MCP/Codex config, preflight/prompt structure, GitHub org
  assumptions, `site-<slug>` working-copy convention, GHCR image publishing,
  and operator handoff gates.
- The workflow domains differ enough that a single shared runbook would be
  brittle. `/new-site` creates a new repo from `siab-site-template` and
  `siab-site-themes`, uses copywriter/auditor/reviewer agents, audits live dev
  preview quality, and deletes the local generated site during cleanup.
  `/add-cms` clones an existing site repo, requires Payload API credentials,
  provisions a tenant, seeds Payload content, converts the site to SSR, keeps
  the local clone for inspection, syncs CMS canvas artifacts, and has strict
  idempotency/destructive-recovery rules.
- The risk boundaries are different. `sitegen` must never modify template/theme
  sources during an engagement; `sitegen-cms` must never modify sibling
  orchestrator/template/theme repos and must never delete Payload tenants or
  content. Keeping separate command contracts preserves those guardrails.

Recommended monorepo shape when this item moves from research to execution:

```txt
packages/tools/siab-orchestrator/
  commands/
    new-site.md
    add-cms.md
  workflows/
    sitegen/
      preflight.md
      prompt.md
      agents/{copywriter,auditor,reviewer}.md
    cms/
      preflight.md
      prompt.md
      agents/{payload-seeder,site-converter,cms-reviewer}.md
  scripts/
    md-to-rtroot.mjs
    sync-cms-artifacts.sh
  runbooks/
    cms-artifact-sync.md
    existing-tenant-redeploy.md
```

The first migration should be a mechanical consolidation with command aliases
and smoke tests only:

1. Create the umbrella orchestrator package/repo.
2. Move both workflows under `workflows/sitegen` and `workflows/cms` with
   minimal text churn.
3. Keep `/new-site` and `/add-cms <slug>` as separate entrypoints.
4. Add a shared root `AGENTS.md` router that selects the workflow by command
   and forbids opening the wrong prompt before that workflow's confirmation
   gate.
5. Preserve both existing smoke-test behaviors: `/new-site` stops after its
   preflight summary, and `/add-cms amblast` stops after its preflight summary
   with the slug known.
6. Only after that works, deduplicate shared prose/config/scripts.

Do not collapse phase agents, cleanup behavior, or idempotency rules during the
first consolidation pass.

Follow-up read-only verification same session:

- Fully read the tracked workflow surfaces in both current orchestrator repos,
  excluding only `.git` and installed dependency directories.
- `siab-site-orchestrator` is a site creation workflow: it depends on local
  `siab-site-template` and `siab-site-themes` clones, writes only
  `./site-<slug>/`, uses copywriter/auditor/reviewer agents, requires preview
  sign-off before publishing, and deletes the local generated site at cleanup.
- `siab-payload-orchestrator` is a CMS conversion workflow: it depends on
  Payload API credentials, clones an existing `optidigi/site-<slug>` repo,
  provisions/seeds a tenant, converts the site to SSR, keeps the local clone
  for inspection, ships `md-to-rtroot` and CMS artifact sync helpers, and has
  explicit no-tenant-deletion / no-incremental-patching recovery rules.
- Read-only `codex exec --sandbox read-only --ephemeral` smoke tests were run
  for `/new-site` from `siab-site-orchestrator` and `/add-cms amblast` from
  `siab-payload-orchestrator`. Both tests avoided file writes and did not open
  `prompt.md`; both stopped because `gh auth status` is not authenticated in the
  smoke environment.

Smoke-test nuance: both command contracts say to read `preflight.md`, while each
preflight says to run the `gh auth status` readiness check before reading the
rest of the document. In the smoke runs, the agent read the preflight file first
and only then ran the `gh` check. That did not cross the dangerous
`prompt.md`/mutation gate, but a future umbrella orchestrator should remove the
ambiguity by making readiness checks explicit in the command router or by
splitting preflight into a tiny readiness section plus the longer workflow
summary.

#### Update — 2026-06-16 (expected monorepo + VPS end shape)
Fresh end-shape confirmation before moving files:

- Local working-set check found current local repo roots for `siab-payload`,
  `siab-site-template`, `siab-site-orchestrator`,
  `siab-payload-orchestrator`, and `site-amicare-zorg`. Fresh shallow GitHub
  clones under `/tmp/obs119-shape` covered `site-siteinabox`, `site-amblast`,
  and `siab-site-themes`.
- CI/image-name checks confirmed the first monorepo migration should preserve
  existing GHCR image names: `ghcr.io/optidigi/siab-payload:latest`,
  `ghcr.io/optidigi/site-siteinabox:latest`,
  `ghcr.io/optidigi/site-amblast:latest`, and
  `ghcr.io/optidigi/site-amicare-zorg:latest`.
- Read-only VPS check confirmed the live deploy model to preserve:
  `traefik:v3.6` is the only process binding public `80/443`;
  `siteinabox`, `amblast`, `ami-care`, and `siab-payload` are separate
  containers on the shared `proxy` network with Traefik labels; and the only
  current CMS-backed tenant data directory is
  `/srv/data/saas/siab-payload/tenants/7/`.

Expected repository end shape for the first monorepo migration:

```txt
siteinabox/
  AGENTS.md                    # root router for /new-site, /add-cms, app work
  README.md
  package.json                 # workspace root; keep package-manager explicit
  pnpm-workspace.yaml
  .github/workflows/
    ci.yml                     # affected/app matrix, no production contract churn
    build-cms-image.yml        # pushes ghcr.io/optidigi/siab-payload
    build-site-image.yml       # pushes ghcr.io/optidigi/site-siteinabox

  apps/
    cms/                       # current siab-payload
    site/                      # current site-siteinabox
    intake/                    # new app later, not required for first move

  packages/
    site-template/             # current siab-site-template generated-site baseline
    site-contracts/            # add early; shared schemas only when extracted
    site-runtime/              # add after contracts prove stable
    site-blocks/               # add after duplication proves stable
    site-themes/               # current siab-site-themes
    ui/                        # future only; do not extract prematurely
    tools/
      siab-orchestrator/       # one umbrella tool with two workflows:
        commands/
          new-site.md
          add-cms.md
        workflows/
          sitegen/
          cms/
        scripts/
        runbooks/

  sites/                       # intended home for generated/client sites
  docs/
```

First migration scope should be deliberately narrower than the final platform:

1. Move `siab-payload` to `apps/cms`.
2. Move `site-siteinabox` to `apps/site`.
3. Move `siab-site-template` to `packages/site-template`.
4. Move `siab-site-themes` to `packages/site-themes`.
5. Consolidate the two orchestrators into `packages/tools/siab-orchestrator`
   while preserving `/new-site` and `/add-cms <slug>` as separate workflows.
6. Move generated/client site source under `sites/` deliberately, while keeping
   their existing image names and VPS stack entries stable until each migration
   is validated.
7. Add `apps/intake` after the moved repo builds and command smoke tests pass.

Expected VPS/deploy end shape after the first migration:

- No immediate VPS path, container, domain, or database changes.
- `/srv/saas/infra/stacks/siab-payload/compose.yml` keeps pulling
  `ghcr.io/optidigi/siab-payload:latest` and keeps Postgres alongside it.
- `/srv/prod/infra/stacks/siteinabox/docker-compose.yml` keeps pulling
  `ghcr.io/optidigi/site-siteinabox:latest`.
- `/srv/prod/infra/stacks/amblast/compose.yml` and
  `/srv/prod/infra/stacks/ami-care/compose.yml` keep their current image names
  and are not coupled to the monorepo move.
- Traefik remains the only edge proxy. Routing remains compose-label based on
  the shared external `proxy` network; no NPM-style registration helper comes
  back.
- CMS-backed generated sites continue to mount
  `/srv/data/saas/siab-payload/tenants/<tenantId>:/data:ro` and receive
  `cms-editor.css` / font files through the artifact-sync script.
- Monorepo CI is responsible for pushing the same GHCR image tags the VPS
  already consumes. Normal deploy remains `docker compose pull && docker
  compose up -d` from the existing stack directories.

Preferred production stack namespace once the monorepo deploy shape is stable:

```txt
/srv/saas/infra/stacks/siteinabox/
  cms/                         # siab-payload compose; data path unchanged
  apps/
    site/                      # public siteinabox.nl app stack
    intake/                    # future intake app stack
  tenants/
    amblast/                   # generated/client site stack
    ami-care/                  # generated/client CMS-backed site stack
```

Important constraint: this is a stack-file organization change only. The data
paths should remain stable, especially
`/srv/data/saas/siab-payload/tenants/<tenantId>`, so CMS projections,
artifact-sync, backups, and mounted tenant data do not move as part of the
stack namespace cleanup.

Future deploy changes, after the first migration is stable:

- Add `apps/intake` as a separate deployable image and separate Traefik-routed
  stack, likely on `start.siteinabox.nl` unless fresh route research chooses
  another host.
- Keep infra stack definitions out of this monorepo for now. The current
  server/ops infra source remains external to `siteinabox`; revisit only if
  the platform repo becomes the deliberate deploy-stack source of truth.

#### TL;DR implementation plan
1. Create the `siteinabox` monorepo shell and workspace tooling without
   changing production behavior.
2. Move code with minimal path churn:
   `siab-payload -> apps/cms`, `site-siteinabox -> apps/site`,
   `siab-site-template -> packages/site-template`,
   orchestrators into `packages/tools/*`, and `siab-site-themes` into
   `packages/site-themes`.
3. Keep existing GHCR image names stable at first so production deploy contracts
   do not change during the repo migration.
4. Add monorepo-aware CI that builds/tests only affected apps and packages.
5. Add `apps/intake` as a new deployable app and route it separately first
   (likely `start.siteinabox.nl` unless fresh prod research shows path routing
   is safer at implementation time).
6. Extract `packages/site-contracts` before runtime/UI packages so CMS, intake,
   template, generated sites, and tools share schema language.
7. Extract `site-runtime`, `site-blocks`, and `site-themes` only after contracts
   are stable and duplication is proven.
8. Keep deploy-stack source-of-truth outside `siteinabox` for now; if this
   changes later, preserve the current one-container-per-app/site deployment
   model and stable tenant data paths.
9. Later, replace the AI/runbook orchestrator packages with a programmatic
   platform worker/service for provisioning, artifact sync, proxy registration,
   monitoring registration, and deploy/redeploy flows.

#### Update — 2026-06-16 (monorepo implementation checkpoint)
Created the first local `siteinabox` monorepo shell at
`/home/shimmy/Desktop/env/siab/siteinabox`:

- Imported `siab-payload` into `apps/cms`, `site-siteinabox` into `apps/site`,
  `siab-site-template` into `packages/site-template`, and `siab-site-themes`
  into `packages/site-themes`.
- Added root workspace files (`package.json`, `pnpm-workspace.yaml`,
  `pnpm-lock.yaml`, README, AGENTS, MCP placeholders, slash-command wrappers,
  and GitHub workflows).
- Consolidated the two runbook orchestrators into
  `packages/tools/siab-orchestrator` while keeping `/new-site` and
  `/add-cms <slug>` as separate command contracts, preflights, prompts,
  agents, scripts, and runbooks.
- Updated orchestrator commands/agents and template/public-site docs for the
  monorepo paths (`packages/site-template`, `packages/site-themes`,
  `apps/cms`) and preserved the current Traefik/data-path deploy contract.
- Added monorepo image workflows that keep the current VPS-consumed image
  names: `ghcr.io/optidigi/siab-payload` and
  `ghcr.io/optidigi/site-siteinabox`.

Validation in the new monorepo:

- `npm test` in `packages/tools/siab-orchestrator/scripts` passed: 20/20.
- `pnpm --ignore-workspace test` and `pnpm --ignore-workspace build` passed in
  `packages/site-template`.
- `pnpm --ignore-workspace test` and `pnpm --ignore-workspace build` passed in
  `apps/site`; build still reports the existing unresolved runtime reference
  to `/theme/images/icon/icon_33.svg`.
- `pnpm --ignore-workspace typecheck` passed in `apps/cms`.
- `pnpm install --lockfile-only --ignore-scripts` passed at the monorepo root;
  it warns on this workstation because local Node is v24.13.1 while
  `apps/cms` requires Node 26.
- `gh auth status` is authenticated for the local operator account, so the
  command readiness gate should pass on this machine.

No production VPS path, container, domain, database, or tenant data location was
changed by this checkpoint.

#### Update — 2026-06-16 (remaining monorepo hardening)
Follow-up implementation completed the remaining non-deploying scaffold work:

- Added monorepo-level `docs/` and `sites/` README files to document ownership
  boundaries without moving live stacks.
- Added reserved `apps/intake` package and README. It is intentionally a
  non-deploying placeholder for now; root scripts expose `intake:build` and
  `intake:test` as no-op checks until the real intake app is implemented.
- Aligned root package scripts with the validated transitional commands. The
  CMS, public site, and site-template scripts use `--ignore-workspace` so they
  keep working with the imported app-local lockfiles during the migration.
- Promoted the CMS pnpm override/supply-chain policy to the monorepo root and
  regenerated the root lockfile for all six workspace projects.
- Attempted a fresh read-only SSH pull of the live stack files before adding
  compose templates, but the SSH command hung before producing output and was
  cancelled. No compose templates were added from incomplete remote data.
- Follow-up operator correction confirmed generated/client sites are intended
  to move under `sites/`. The placeholder `infra/` directory was removed because
  it had no real stack files and would imply an unconfirmed infra source-of-truth
  change.

Additional validation:

- `npm ci && npm test` in `packages/tools/siab-orchestrator/scripts` passed:
  20/20.
- `npm --prefix apps/intake run build` and
  `npm --prefix apps/intake run test` passed as explicit no-op checks.
- `pnpm install --lockfile-only --ignore-scripts` passed at the root for six
  workspace projects, with the same local Node 24 versus CMS Node 26 warning.

#### Update — 2026-06-16 (new monorepo-owned image names)
Follow-up deploy validation showed that the monorepo workflows can build the
CMS and public-site Docker images, but GHCR rejects pushes to the existing
package names with `permission_denied: write_package` because those packages
were created under the previous source repositories. The operator chose to use
new package names instead of changing existing package-level permissions.

Updated monorepo image contract:

- CMS: `ghcr.io/optidigi/siteinabox-cms:latest`
- Public site: `ghcr.io/optidigi/siteinabox-site:latest`

The VPS should be updated to pull these new image names. Existing VPS stack
paths, container names, domains, database volumes, and tenant data paths remain
unchanged.

#### Update — 2026-06-16 (VPS switched to platform-owned images)
Production VPS rollout completed over `ssh prod`:

- Backed up live compose files:
  `/srv/saas/infra/stacks/siab-payload/compose.yml.bak-platform-image-20260616T165108Z`
  and
  `/srv/prod/infra/stacks/siteinabox/docker-compose.yml.bak-platform-image-20260616T165108Z`.
- Updated CMS compose to pull
  `ghcr.io/optidigi/siteinabox-cms:latest`.
- Updated public Site in a Box compose to pull
  `ghcr.io/optidigi/siteinabox-site:latest`.
- Pulled and recreated the `siab-payload` service. The container is healthy,
  its startup log reports no pending migrations, and
  `/api/health` inside the container returns `{"status":"ok","db":"connected","dataDir":"writable"}`.
- Pulled and recreated the `siteinabox` container from service `web`. The
  container is healthy and serves the page on `127.0.0.1:80` inside the
  container.
- External smoke checks returned HTTP 200 for
  `https://admin.siteinabox.nl/api/health`,
  `https://admin.ami-care.nl/api/health`, and `https://siteinabox.nl/`.

The stack paths, service/container names, Postgres volume, Traefik labels, and
tenant data path were not moved.

#### Update — 2026-06-16 (generated sites imported and VPS stack namespace finalized)
Final consolidation pass completed the repo and server shape:

- Imported generated/client site source into the monorepo:
  `site-amicare-zorg -> sites/ami-care` and
  `site-amblast -> sites/amblast`.
- Preserved generated-site production image names:
  `ghcr.io/optidigi/site-amicare-zorg:latest` and
  `ghcr.io/optidigi/site-amblast:latest`.
- Added root helper scripts for tenant site checks:
  `tenant:amicare:build`, `tenant:amicare:responsive`, and
  `tenant:amblast:build`.
- Reorganized the live VPS stack files under the platform namespace:

```txt
/srv/saas/infra/stacks/siteinabox/
  cms/                         # siab-payload compose + .env
  apps/
    site/                      # public siteinabox.nl compose
    intake/                    # reserved; no intake service/image deployed yet
  tenants/
    amblast/                   # generated/client site compose
    ami-care/                  # generated CMS-backed tenant site compose
```

- Added explicit Compose project names in the moved stack files so the existing
  Docker project labels, container names, and `siab-payload_postgres-data`
  volume remain stable after running from the new directories.
- Archived the old stack directories under
  `/srv/saas/infra/stacks/siteinabox/_archive/obs119-20260616T170505Z`.
- Kept tenant data paths unchanged, especially
  `/srv/data/saas/siab-payload/tenants/7`.
- Updated copied VPS compose comments to refer to Traefik and the new stack
  paths instead of NPM/legacy paths.

Validation:

- `docker compose config --services` passed from all four new stack paths.
- `docker compose pull && docker compose up -d` passed from all four new stack
  paths.
- Running containers still use the intended projects/images:
  `siab-payload` on `ghcr.io/optidigi/siteinabox-cms:latest`,
  `siteinabox` on `ghcr.io/optidigi/siteinabox-site:latest`,
  `ami-care` on `ghcr.io/optidigi/site-amicare-zorg:latest`, and
  `amblast` on `ghcr.io/optidigi/site-amblast:latest`.
- External smoke checks returned HTTP 200 for
  `https://admin.siteinabox.nl/api/health`,
  `https://admin.ami-care.nl/api/health`, `https://siteinabox.nl/`,
  `https://ami-care.nl/healthz`, and `https://amblast.siteinabox.nl/`.

OBS-119 is closed for monorepo/deploy consolidation. Building the real intake
product and deploying an intake image remain future feature work; this item only
reserved `apps/intake` and the matching server stack namespace.

#### Follow-up cleanup — 2026-06-16
Post-consolidation cleanup removed the migration backup/archive artifacts from
the live VPS stack tree:

- Removed `/srv/saas/infra/stacks/siteinabox/_archive/`.
- Removed copied `*.bak*` compose files under
  `/srv/saas/infra/stacks/siteinabox/`.
- Removed unused local Docker images for the old platform app package names:
  `ghcr.io/optidigi/siab-payload:*` and
  `ghcr.io/optidigi/site-siteinabox:latest`.

Verification after cleanup:

- Active compose files still point at
  `ghcr.io/optidigi/siteinabox-cms:latest`,
  `ghcr.io/optidigi/siteinabox-site:latest`,
  `ghcr.io/optidigi/site-amicare-zorg:latest`, and
  `ghcr.io/optidigi/site-amblast:latest`.
- No backup/archive files remain under the SIAB platform stack tree.
- External smoke checks returned HTTP 200 for
  `https://admin.siteinabox.nl/api/health`,
  `https://admin.ami-care.nl/api/health`, `https://siteinabox.nl/`,
  `https://ami-care.nl/healthz`, and `https://amblast.siteinabox.nl/`.

#### Follow-up finalization — 2026-06-16
The VPS stack namespace was tightened so all deployable SIAB apps live under
`/srv/saas/infra/stacks/siteinabox/apps/`:

- Moved CMS stack files from
  `/srv/saas/infra/stacks/siteinabox/cms` to
  `/srv/saas/infra/stacks/siteinabox/apps/cms`.
- Kept the existing Compose project name `siab-payload`, container names,
  Traefik labels, Postgres volume `siab-payload_postgres-data`, and tenant data
  paths unchanged.
- Added monorepo-owned tenant site image workflows:
  `ghcr.io/optidigi/siteinabox-site-ami-care:latest` and
  `ghcr.io/optidigi/siteinabox-site-amblast:latest`.
- Removed the imported per-site `.github/workflows/` files because GitHub only
  runs workflows from the repository root.
- Published and smoke-started both tenant images from the monorepo, switched
  the VPS tenant stacks to those image names, pulled/recreated the tenant
  containers, and removed the old local tenant images from the VPS.
- Pulled/recreated the CMS stack from `ghcr.io/optidigi/siteinabox-cms:latest`.
- Confirmed live containers are healthy and now point at:
  `ghcr.io/optidigi/siteinabox-cms:latest`,
  `ghcr.io/optidigi/siteinabox-site:latest`,
  `ghcr.io/optidigi/siteinabox-site-ami-care:latest`, and
  `ghcr.io/optidigi/siteinabox-site-amblast:latest`.
- External smoke checks returned HTTP 200 for
  `https://admin.siteinabox.nl/api/health`,
  `https://admin.ami-care.nl/api/health`, `https://siteinabox.nl/`,
  `https://ami-care.nl/healthz`, and `https://amblast.siteinabox.nl/`.

The old GitHub repositories are obsolete for builds/deployments and can be
deleted after any final manual archival preference:
`Optidigi/siab-payload`, `Optidigi/site-siteinabox`,
`Optidigi/siab-site-template`, `Optidigi/siab-site-themes`,
`Optidigi/siab-site-orchestrator`, `Optidigi/siab-payload-orchestrator`,
`Optidigi/site-amicare-zorg`, and `Optidigi/site-amblast`.

#### Final namespace rename — 2026-06-16
The monorepo itself was renamed from `Optidigi/siab-platform` to
`Optidigi/siteinabox`, and the root package/repo docs now use `siteinabox` as
the canonical name.

Final image names are:

- `ghcr.io/optidigi/siteinabox-cms:latest`
- `ghcr.io/optidigi/siteinabox-site:latest`
- `ghcr.io/optidigi/siteinabox-site-ami-care:latest`
- `ghcr.io/optidigi/siteinabox-site-amblast:latest`

Production was updated to match:

- VPS stack root moved from `/srv/saas/infra/stacks/siab-platform` to
  `/srv/saas/infra/stacks/siteinabox`.
- Docker Compose metadata for `siab-payload`, `siteinabox`, `ami-care`, and
  `amblast` now points at the new stack paths.
- Old local VPS images for `ghcr.io/optidigi/siab-platform-*` were removed.
- Public smoke checks returned HTTP 200 for
  `https://admin.siteinabox.nl/api/health`,
  `https://admin.ami-care.nl/api/health`, `https://siteinabox.nl/`,
  `https://ami-care.nl/healthz`, and `https://amblast.siteinabox.nl/`.

#### Acceptance criteria
1. The monorepo is the source of truth for CMS, public site, intake,
   site-template, generated site source, shared packages, orchestration tools,
   and platform docs.
2. Production deploys still use isolated containers for CMS, public site,
   intake, and generated tenant sites.
3. Existing domains and admin hosts continue to route correctly after migration.
4. CMS-backed tenant sites still consume read-only tenant artifacts from the
   production data directory.
5. CI and deploy docs explain how each app/package is built, tested, imaged, and
   deployed.
6. A fresh implementation-time research note confirms the then-current repo and
   VPS shape before any migration work begins.

### OBS-116 — Activate production Better Auth provider credentials and email transport

**Status:** Active · **Layer:** infra / auth operations
**Discovered in:** Session 2026-06-11 (OBS-101 deployment follow-up)

#### Description
OBS-101 shipped the Better Auth/Payload bridge, passwordless login UI, Better
Auth tables, dynamic tenant-host validation, and production deploy. The core
code is live. Better Auth Infrastructure `dash()` is now connected in
production, but Google/Microsoft/Apple provider credentials and the paid-plan
email migration remain intentionally pending.

#### Required setup
- Register Google, Microsoft, and Apple apps for every admin host that should
  expose social login. Callback URLs use
  `https://<admin-host>/api/auth/callback/{google|microsoft|apple}`.
- Fill production env with `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`,
  `MICROSOFT_TENANT_ID=common` unless a narrower tenant is desired,
  `APPLE_CLIENT_ID`, and `APPLE_CLIENT_SECRET`.
- Set a dedicated `BETTER_AUTH_SECRET` in production. `PAYLOAD_SECRET` fallback
  works for bootstrapping, but the long-term production shape should keep Better
  Auth's signing/encryption secret separate.
- Completed 2026-06-17: `@better-auth/infra` is wired behind
  `BETTER_AUTH_API_KEY` for the dashboard/audit `dash()` bridge. Production is
  connected to the existing SIAB project in the Better Auth Infrastructure
  dashboard; the key lives in VPS `.env`, not repo config. Leave
  `BETTER_AUTH_API_URL` and `BETTER_AUTH_KV_URL` blank unless the dashboard
  provides overrides.
- Configure production email delivery for magic links through the selected
  mailer. This likely lands with OBS-100 if Cloudflare becomes the production
  transport; otherwise ensure the existing `RESEND_API_KEY`/`EMAIL_FROM` path
  is intentionally retained and monitored.
- Use `BETTER_AUTH_ALLOWED_HOSTS` only for preview or non-tenant admin hosts
  that cannot be resolved from Payload tenants. Normal generated tenant admin
  hosts are covered by the dynamic Payload host gate and Better Auth's
  `admin.*` dynamic base-url pattern.

#### Acceptance criteria
1. Production social buttons appear only for configured providers.
2. Google, Microsoft, and Apple sign-in each complete for an existing eligible
   Payload user whose verified provider email matches exactly.
3. Email magic link delivery completes through the selected production mailer
   and bridges to a normal Payload session.
4. Unknown users, unverified provider emails, ambiguous Payload users, suspended
   tenants, and cross-tenant admin hosts fail closed.
5. Fresh production boot logs are free of Better Auth base-url warnings and
   `/api/health` remains healthy after env changes.
6. If `BETTER_AUTH_API_KEY` is configured, Better Auth Infrastructure dashboard
   audit/activity events appear for test sign-ins.

#### Production note 2026-06-17
Deployed commits `f87c3b4` and `021bf61` installed `@better-auth/infra`, wired
`dash()`, passed CI and image smoke-start, and were deployed to the CMS. The
Better Auth dashboard connection succeeded. OAuth provider env vars remain
blank, so social provider buttons stay hidden until apps/secrets are configured.

### OBS-121 — Rename CMS production containers to siteinabox convention

**Status:** Closed 2026-06-17 · **Layer:** infra / deploy naming
**Discovered in:** Session 2026-06-17 (post Better Auth Infra deploy cleanup)

#### Description
The repo/app/image naming had moved to `apps/cms` and
`ghcr.io/optidigi/siteinabox-cms`, but the live production containers still used
legacy `siab-payload` and `siab-payload-postgres` names. This conflicted with
the siteinabox deploy naming convention and confused Better Auth / deploy
discussion.

#### Resolution
- Production compose now uses project/service/container names
  `siteinabox-cms` and `siteinabox-cms-postgres`.
- Traefik router/service labels now use `siteinabox-cms`.
- The Postgres Docker volume remains pinned to
  `siab-payload_postgres-data` to preserve the existing production database.
- The bind-mounted tenant data path remains `/srv/data/saas/siab-payload` per
  deploy invariant and generated-site mount contract.

#### Production note 2026-06-17
Deployed commits `da648a7` and `41715a4` to production after CI and the CMS
image smoke-start passed. `41715a4` sets `CI=true` in the Docker builder stage
so Payload generation cannot trigger an interactive pnpm module purge prompt in
GitHub Actions. Production now runs healthy `siteinabox-cms` and
`siteinabox-cms-postgres` containers against the preserved
`siab-payload_postgres-data` volume; the empty legacy `siab-payload_internal`
network was removed.

### OBS-100 — Integrate Cloudflare mailer as the production email transport

**Status:** Active · **Layer:** infra / email delivery
**Discovered in:** Session 2026-06-02 (operator backlog request)

#### Description
`siab-payload` currently has a Resend-backed email helper and invite/reset flows
that tolerate missing email configuration. Production email should be reviewed
and moved to, or augmented with, a Cloudflare mailer path so transactional mail
is reliable under the chosen infrastructure.

The exact Cloudflare product/API needs to be selected and verified before code
changes. Do not assume the current Resend helper can be swapped blindly: Payload
password reset, invite links, sender domain verification, DKIM/SPF/DMARC,
bounce/error handling, and local/staging behavior all need an explicit contract.

#### Suggested fix shape
1. Research the intended Cloudflare mail product/API and its current supported
   send path, authentication model, rate limits, and domain-verification
   requirements.
2. Decide whether Cloudflare replaces Resend or becomes a selectable provider
   behind a transport abstraction.
3. Add environment variables and runbook notes for sender domain, API token,
   from address, reply-to, and disabled/local-dev behavior.
4. Wire Payload auth email flows and app helper sends through the selected
   transport. Preserve the existing safe no-op/error logging behavior for
   missing local config where appropriate.
5. Add tests for provider selection, missing-config behavior, reset/invite email
   rendering, and transport error handling without sending real email.
6. Verify DNS records and deliverability in staging before production cutover.

#### Acceptance notes
Completion should include a deployment/runbook update and a production smoke
test that sends a password reset or invite to a controlled mailbox.

### OBS-98 — Fresh `/add-cms` generation path drifted from current SiteSettings contract

**Status:** Closed 2026-06-02 · **Layer:** multi-repo (`siab-payload-orchestrator` + `siab-site-template` + generated site repos)
**Discovered in:** Session 2026-06-02 (orchestrator/template/design/CMS sync verification)

#### Description
The existing production Amicare site has been patched to consume the current
Payload projection shape (`siteName`, `siteUrl`, `contact.social`,
`navHeader`, `navFooter`, `nap.streetAddress`, `hours[].day/open/close`), but
the fresh `/add-cms` runbook in `siab-payload-orchestrator` still contains stale
SiteSettings assumptions from the older static template shape:

- `payload-seeder.md` documents `nav -> navigation` and builds the POST body
  with `navigation: $navigation`; the current `SiteSettings` schema uses
  `navHeader` / `navFooter`, so a fresh run can silently drop seeded navigation.
- `site-converter.md` still scaffolds/teaches `SiteSettings` as
  `brand`, `primaryDomain`, `socials`, `nav`, and older NAP/hour field names,
  while current `settingsToJson` projects the newer names listed above.
- The current template and generated-site contract support the fixed seven CMS
  block types via `siteManifest.blocks[]`; manifests gate/label those blocks,
  but do not synthesize arbitrary new Payload schemas/renderers from theme or
  component-library metadata.
- Public form plumbing is inconsistent across generic template vs patched
  tenant: `siab-payload` exposes public `forms` creates and Amicare posts its
  contact block to `/api/forms`, but `siab-site-template`'s generic
  `ContactSection` still emits a `method="POST"` form without an `action`.

This does not break the already-patched Amicare deployment, but it means a fresh
generated site is not yet guaranteed e2e-complete without operator correction.

#### Resolution
The fresh generation path now matches the current Payload projection contract:

- `siab-payload-orchestrator/.claude/agents/payload-seeder.md` seeds
  `navHeader` / `navFooter` in Payload's current schema shape. The Codex
  `payload-seeder` wrapper points at this canonical Claude contract, so both
  agent paths use the same mapping.
- `siab-payload-orchestrator/.claude/agents/site-converter.md` now scaffolds
  `SiteSettings` with `siteName`, `siteUrl`, `contact.social`, `navHeader`,
  `navFooter`, `nap.streetAddress`, `hours[].day/open/close`, optional
  `CTA.primary`, `CTA.backgroundImage`, and generic fallbacks only. The Codex
  `site-converter` wrapper points at the same canonical contract.
- `siab-payload-orchestrator/.claude/agents/cms-reviewer.md` now blocks old
  runtime field names and tenant-specific fallback leaks in layout, SEO, pages,
  and CMS renderers. The Codex `cms-reviewer` wrapper points at the same
  canonical contract.
- `siab-site-template` now exposes matching runtime types, forwards Hero pills
  and CTA image/eyebrow data through preview rendering, supports optional CTA
  primary actions, posts ContactSection forms to `/api/forms` with `formName`,
  and lets SEO/JSON-LD helpers consume either static starter config or current
  CMS `SiteSettings`.
- `siab-payload` shared block defaults no longer carry Roermond/Persoonlijke
  copy or old `werkwijze` / `wat-telt` canvas anchor fallbacks.

#### Verification
`siab-payload`: `pnpm payload generate:types`, focused Vitest for generic canvas
defaults, `pnpm payload:contract`, `pnpm registry:check`, `pnpm lint:no-css`,
and `pnpm typecheck` passed locally under Node 24 with the expected Node 26
engine warning.

`siab-site-template`: installed dependencies, then `pnpm astro check`,
`pnpm test`, `pnpm build`, and `pnpm check:responsive` passed. Astro check only
reported existing hints.

`siab-payload-orchestrator/scripts`: installed dependencies and `npm test`
passed.

`siab-site-orchestrator`: no code changes required; its Codex wrappers route to
the canonical Claude workflow and its reviewer already requires
`siteManifest.json` before sign-off.

### OBS-97 — GHCR image build cache/export path still leaves avoidable latency — RESOLVED

**Status:** Closed 2026-06-01 · **Layer:** infra (GitHub Actions / Docker / GHCR)
**Discovered in:** Session 2026-06-01 (GHCR image build-speed research)
**Files:** `Dockerfile`, `.github/workflows/build-image.yml`

#### Description
Recent GHCR image-build research found that the old ~12 minute image build was
primarily a pre-upgrade cold/slow path: the 2026-06-01 13:36 UTC run built with
Node 24, Next 15.4.11, and webpack, spending about 7 minutes inside
`next build`. After the Node 26 / Next 16.2.6 / Turbopack upgrade, later image
runs dropped to about 3-5 minutes.

The remaining avoidable latency is now mostly Docker cache mechanics:

- `docker/build-push-action` with `cache-to: type=gha,mode=max` can spend
  2+ minutes exporting cache on dependency/package changes.
- The multi-stage Dockerfile copies a large `node_modules` tree from `deps` to
  `builder`, which took about 30 seconds on a cached run and also inflates the
  remote cache/export surface.
- The Dockerfile installs pnpm in both `deps` and `builder`.
- The install layer is keyed on `package.json` and the lockfile together, so
  package metadata/script-only changes can invalidate a full install instead of
  reusing a lockfile-keyed pnpm store.

#### Suggested fix shape
1. Collapse the separate `deps` + `builder` stages into a single build stage
   that installs dependencies, copies source, builds, and then only copies
   standalone outputs into the runtime stage.
2. Switch dependency setup to a `pnpm fetch` / offline install shape so the
   expensive store population is keyed primarily by `pnpm-lock.yaml`.
3. A/B test the current `type=gha,mode=max` cache against a GHCR registry cache
   such as `type=registry,ref=ghcr.io/optidigi/siab-payload:buildcache,mode=max`
   and record cache export/import timing on package-change and source-only
   commits.
4. Consider BuildKit cache mounts for pnpm and `.next/cache` only if the chosen
   cache backend actually persists them across GitHub-hosted runner jobs, or if
   the build moves to a persistent self-hosted/larger runner.
5. Add workflow `paths-ignore` only for changes that do not need a per-SHA image
   tag, such as docs-only commits, if deployment practice does not require an
   image for every `main` commit.

#### Current verification
Workflow log comparison:

- Slow reference run `26758331788` / job `78864333794`: total job about
  12 minutes; `Build + push image` about 11 minutes; `next build` compiled in
  about 7 minutes on Next 15.4.11; GitHub Actions cache export about 140
  seconds.
- Current fast run `26765526058` / job `78890708988`: total job about
  4.5 minutes; `Build + push image` about 3.6 minutes; Next 16.2.6 / Turbopack
  compiled successfully in about 30 seconds; TypeScript inside `next build`
  took about 11 seconds; GitHub Actions cache export about 124 seconds after a
  package change.
- Cached run `26764681844` / job `78887621613`: `COPY --from=deps
  /app/node_modules` took about 30 seconds, the build step took about 59
  seconds, and cache export took about 24 seconds.

#### Implementation attempt — 2026-06-01
The first optimization pass is intentionally narrow:

- `Dockerfile` now uses a single `builder` stage instead of copying
  `node_modules` from a separate `deps` stage.
- Dependency setup uses `pnpm fetch --frozen-lockfile --store-dir=/pnpm/store`
  before `COPY package.json`, followed by
  `pnpm install --frozen-lockfile --offline --store-dir=/pnpm/store`. The pnpm
  store is kept in an image layer, not a BuildKit cache mount, so fresh
  GitHub-hosted runners do not depend on cache-mount hydration for offline
  install correctness.
- The image workflow imports cache from both the new GHCR registry cache and
  the old GitHub Actions cache during transition, but exports only to
  `ghcr.io/optidigi/siab-payload:buildcache`.
- The pushed-image smoke-start remains intact. The workflow now prints
  `metric docker_pull_seconds`, `metric smoke_healthy_seconds`, and
  `metric image_size_bytes` for later comparison.

Rejected for the first pass: `.next/cache` mounts, pnpm cache mounts, removing
smoke-start, and broad `.dockerignore` churn. Docs-only `paths-ignore` remains
a separate policy decision because it would intentionally skip per-SHA GHCR
images for those `main` commits.

Acceptance requires a successful image build and smoke-start, then at least one
warm follow-up run to compare cache import/export timing against the baseline
above. The first registry-cache run may be slower while seeding `buildcache`.

Local validation after the first pass:

- `pnpm fetch --frozen-lockfile --store-dir=<tmp>/store` followed by
  `pnpm install --frozen-lockfile --offline --store-dir=<tmp>/store` passed in
  a scratch directory. The local shell warned about Node 24 because the repo
  runtime contract is Node 26; the container build below ran under Node 26.
- `podman build --progress=plain --target runner -t
  siab-payload-build-speed:test .` passed. Inside the container,
  `pnpm fetch`, offline install, Payload type/importmap generation, `next
  build`, and `scripts/build-runtime-bundle.mjs` all completed.
- A temporary Podman pod with `postgres:18-alpine` smoke-started the built image.
  `/api/health` returned `{"status":"ok","db":"connected","dataDir":"writable"}`
  and the boot logs did not contain `unsettled top-level await` or
  `exit code 13`.
- Local image size for `localhost/siab-payload-build-speed:test` was
  `275391487` bytes.
- Docker was not installed in this environment, so local validation used Podman.
  The GitHub Actions pushed-image smoke-start remains the required Docker/GHCR
  acceptance gate.

#### Resolution — 2026-06-01
Committed and deployed as `3451469b3e18c2cfe0fffe77e3e31f7aaeb3e0bd`.

GitHub Actions verification:

- Push-triggered seed run `26771765263` passed in `2m56s`, with
  `Build + push image` taking `2m11s`. This run created the missing
  `ghcr.io/optidigi/siab-payload:buildcache` registry cache. Cache export to
  registry took `44.8s`.
- The seed run's pushed-image smoke-start passed:
  `metric docker_pull_seconds=4`,
  `metric smoke_healthy_seconds=3`,
  `metric image_size_bytes=270447113`.
- CI run `26771765410` passed: typecheck/registry/no-css/responsive gates and
  full Vitest suite.
- Warm workflow-dispatch run `26771968610` passed in `1m01s`, with
  `Build + push image` taking `12s`. Registry cache import took `1.2s`; all
  Dockerfile build layers were cached; cache export took `2.6s`.
- The warm run's pushed-image smoke-start passed:
  `metric docker_pull_seconds=5`,
  `metric smoke_healthy_seconds=3`,
  `metric image_size_bytes=270447113`.

Production deploy verification:

- VPS pulled and recreated `siab-payload` from `ghcr.io/optidigi/siab-payload:latest`.
- Running production labels now report revision
  `3451469b3e18c2cfe0fffe77e3e31f7aaeb3e0bd`, image digest
  `sha256:cced3178b2103c876a1ed774d3dd66e5e9e94e05329908960560d2918d4563dc`,
  and image created timestamp `2026-06-01T17:51:02.293Z`.
- Docker health is `healthy`.
- Boot migration was a no-op: `[migrate-on-boot] no pending migrations (103ms)`.
- Public health passed:
  `https://admin.siteinabox.nl/api/health` returned
  `{"status":"ok","db":"connected","dataDir":"writable"}`.

The old ~12 minute build path is no longer representative. The measured
steady-state GHCR image build path is now about one minute end-to-end including
smoke-start, with the Docker build/push step itself at about 12 seconds when the
registry cache is warm.

---

## Closed — current items

### OBS-94 — Runtime, dependency, and stale install drift after May 2026 maintenance audit — RESOLVED

**Status:** Closed 2026-06-01 · **Layer:** infra / dependency hygiene (`siab-payload` + `design-systems`)
**Discovered in:** Session 2026-05-28 (supersedence / dead-code / compatibility audit)

#### Description
The 2026-05-28 maintenance audit did not find a new confirmed security exploit,
but it did find repo-state drift that should be handled as a planned maintenance
batch instead of ad hoc upgrades:

- `siab-payload` production Docker stages use `node:24-alpine` and the local
  shell is Node `v24.14.0`, but `.github/workflows/ci.yml` still runs both
  typecheck and tests with `actions/setup-node@v6` `node-version: 22`. The repo
  contract in `AGENTS.md` says Node 24 in Docker/CI, so CI is not exercising the
  same major runtime as the container.
- `@types/node` is pinned to `22.19.17` while the runtime contract is Node 24.
  `pnpm outdated` reports `25.9.1` as the npm `latest`, but the compatible
  target for this app should be the newest `@types/node@24.x` line unless the
  runtime is intentionally moved to Node 26/current.
- `design-systems` still builds with `node:22-alpine` and its image workflow
  uses `actions/checkout@v4`, while `siab-payload` already moved the image
  build path to Node 24-capable action majors.
- `pnpm outdated --format json` reports available updates for the Payload suite
  (`3.84.1` -> `3.85.0`), React (`19.2.5` -> `19.2.6`), Tailwind (`4.2.4` ->
  `4.3.0`), Vitest (`4.1.5` -> `4.1.7`), Playwright (`1.59.1` -> `1.60.0`),
  Lexical (`0.41.0` -> `0.44.0`), Next (`15.4.11` -> `16.2.6`), TypeScript
  (`5.6.3` -> `6.0.3`), and other direct deps. Major upgrades should be
  compatibility-tested, not bulk-applied blindly.
- `pnpm` is pinned to `10.28.2`; npm registry currently reports a newer major
  line. Keep the pin unless/until the lockfile and CI behavior are tested under
  the new major.
- Direct dev dependencies `autoprefixer` and `@testing-library/jest-dom` are
  installed but not referenced by current config/tests. Tailwind v4 uses
  `@tailwindcss/postcss` directly in `postcss.config.js`.
- Installed registry-owned UI primitives `block-chip`, `breadcrumb`, `command`,
  `drawer`, and `tabs` are not imported by runtime app code. They may still be
  intentionally kept as registry contract fixtures, but should be reviewed
  before the next registry pull list is treated as app-required surface.

#### Validation
Local checks from the audit session:

- `pnpm lint:no-css` passed.
- `pnpm registry:check` passed with no drift across 55 `@siab/*` items.
- `pnpm typecheck` fails on a clean checkout until ignored Payload generated
  artifacts exist (`src/app/(payload)/admin/importMap.js`), matching the deploy
  runbook. After `pnpm payload generate:types` and
  `pnpm payload generate:importmap`, `pnpm typecheck` passed.
- `git status --short` was clean in both `siab-payload` and `design-systems`
  after the checks; generated Payload artifacts are ignored.

#### Suggested fix shape
1. Align CI/runtime first: switch `siab-payload` CI jobs to Node 24, update
   `@types/node` to the newest 24.x release, and verify typecheck + full Vitest.
2. Bring `design-systems` Docker/workflow runtime and checkout action to the
   same supported major line, then rebuild/pull the registry.
3. Apply low-risk patch/minor direct dependency updates in a small batch with
   typecheck, full tests, registry drift, and focused e2e where canvas/rich-text
   dependencies change.
4. Treat Next 16, TypeScript 6, Lexical 0.44, and pnpm major upgrades as a
   separate compatibility batch with Payload release-note review and a full
   local dev-server smoke pass.
5. Remove or justify unused direct dev deps and unused installed registry
   primitives. Do not hand-edit files under `src/components/ui/`; change the
   design-system registry/pull list first if removal is appropriate.

#### Current verification — 2026-05-28
Still current after open-backlog re-audit. `siab-payload` CI still pins
`node-version: 22` while its Dockerfile uses `node:24-alpine`; `@types/node`
is still `22.19.17`; `design-systems` still uses `node:22-alpine` and
`actions/checkout@v4`; the unused direct dev-dep and unused installed
registry-primitive candidates remain present.

#### Update — 2026-06-01
Runtime-alignment and stale-install cleanup slice completed:

- `siab-payload` CI typecheck/registry and Vitest jobs now run Node 24,
  matching the Dockerfile/runtime contract.
- `siab-payload` package engines now require Node `>=24.0.0`.
- `@types/node` moved from `22.19.17` to the newest compatible 24.x line
  available at implementation time, `24.12.4`. The npm `latest` dist-tag was
  `25.9.1`, intentionally not used.
- Unreferenced direct dev dependencies `autoprefixer` and
  `@testing-library/jest-dom` were removed from `package.json` and the lockfile.
- `design-systems` now builds the registry image from `node:24-alpine`, uses
  `actions/checkout@v5` in its image workflow, forces JS-based Docker actions
  onto Node 24, and requires Node `>=24.0.0`.

Validation from this slice:

- `siab-payload`: Payload type/importmap generation + `pnpm typecheck` passed.
- `siab-payload`: `pnpm test tests/unit/` passed, 91 files / 832 tests.
- `siab-payload`: full `pnpm test` passed, 100 files / 864 tests, using a
  disposable Podman Postgres 17 container on `localhost:5432`.
- `siab-payload`: `pnpm lint:no-css` passed.
- `siab-payload`: `pnpm registry:check` passed with no drift across 55
  `@siab/*` items.
- `design-systems`: `pnpm install --frozen-lockfile` and `pnpm build:all`
  passed under local Node 24.

Follow-up same session completed the dependency compatibility batch:

- Direct dependencies were refreshed where compatible: Payload suite `3.85.0`,
  React `19.2.6`, Tailwind `4.3.0`, Playwright `1.60.0`, Next `16.2.6`,
  TypeScript `6.0.3`, and related minor/patch updates.
- Next 16 proxy convention was applied by renaming `src/middleware.ts` to
  `src/proxy.ts`, exporting `proxy`, and updating middleware/proxy unit tests
  and source references.
- `next.config.mjs` now uses top-level `reactCompiler` instead of the removed
  experimental key.
- `pnpm` moved from `10.28.2` to `11.5.0`. Build-script approvals now live in
  `pnpm-workspace.yaml` using pnpm 11's supported `onlyBuiltDependencies` /
  `allowBuilds` config, and CI now lets `pnpm/action-setup` read the
  `packageManager` pin instead of carrying a separate stale pnpm version.
- The stale CI `pnpm lint` step was removed after Next 16 made `next lint`
  fail as an invalid command. The repo's documented CI gates remain
  typecheck, registry drift, responsive canvas contract, `lint:no-css`, and the
  full Vitest suite.
- A local declaration was added for the Payload Next CSS side-effect import that
  TypeScript 6 no longer resolves implicitly.
- Installed registry-owned primitive candidates (`block-chip`, `breadcrumb`,
  `command`, `drawer`, and `tabs`) were reviewed. Runtime app code still does
  not import those primitives directly, and they were retained as installed
  registry primitives rather than treated as app-required runtime surface; any
  future removal belongs in the registry/pull-list path, not by hand-editing
  `src/components/ui/`.

Intentional version holds after the update:

- `@types/node` remains on `24.12.4` because the app runtime contract is Node
  24; npm `latest` is Node 25 types.
- `eslint` remains on `9.39.4` because `eslint-config-next@16.2.6` peers on
  ESLint 9.
- `lexical` / `@lexical/*` remain on `0.41.0` because Payload `3.85.0`'s
  dependency checker rejects newer Lexical majors/minors and requires `0.41.0`.

Validation for the compatibility batch:

- `pnpm install` passed under pnpm `11.5.0`.
- `pnpm payload generate:types` and `pnpm payload generate:importmap` passed.
- `pnpm typecheck` passed.
- `pnpm build` passed.
- `pnpm lint:no-css` passed.
- `pnpm registry:check` passed with no drift across 55 `@siab/*` items.
- Focused proxy/security unit tests passed, 4 files / 67 tests.
- Full `pnpm test` passed, 100 files / 864 tests, using a disposable Podman
  Postgres 17 container on `localhost:5432`.
- Final `pnpm outdated --format json` reports only the intentional holds listed
  above.

OBS-94 is closed. The originally listed runtime, stale-install, dependency,
pnpm, and registry-primitive review work has either landed or been documented as
an intentional compatibility hold.

### OBS-95 — Pre-use newest-runtime uplift to Node 26 and PostgreSQL 18 — RESOLVED

**Status:** Closed 2026-06-01 · **Layer:** infra / dependency hygiene (`siab-payload`)
**Discovered in:** Session 2026-06-01 (operator asked to take disruptive newest-version upgrades before app use)

#### Description
After OBS-94 closed on conservative production-compatible holds, the operator
clarified that this Payload app is not in active use yet. That made the
disruptive newest-version path acceptable now rather than later.

#### Resolution
The app runtime and test/deploy database targets were moved to the newest
available major lines checked during implementation:

- Node runtime target moved from Node 24 LTS to Node `26.2.0` / `node:26-alpine`.
  Docker stages, CI `actions/setup-node`, `package.json` engines, and
  `AGENTS.md` were updated to the Node 26 contract.
- The Dockerfile no longer relies on `corepack`; Node 26 did not expose it in
  local verification. Build stages now install the pinned package manager with
  `npm install -g pnpm@11.5.0`.
- PostgreSQL image targets moved from `postgres:17-alpine` to
  `postgres:18-alpine` in production compose, local compose, and CI service
  containers. Compose volume mounts now target `/var/lib/postgresql`, matching
  the PostgreSQL 18 Docker image layout.
- Remaining npm direct dependencies were updated where accepted:
  `@types/node` `25.9.1`, `vitest` / `@vitest/ui` `4.1.8`.
- The stale ESLint direct-dependency stack and `.eslintrc.json` were removed.
  The old Next lint wrapper was already removed from CI in OBS-94; required
  gates remain typecheck, registry drift, responsive canvas, `lint:no-css`, and
  Vitest.
- `pnpm-workspace.yaml` temporarily used `minimumReleaseAge: 0` during the
  pre-use newest-version window. Follow-up update-management audit restored the
  steady-state supply-chain delay to `minimumReleaseAge: 1440`, with
  exact-version exclusions only for the freshly-published packages already
  validated during the pre-use upgrade session.

The only remaining outdated direct packages are `lexical` / `@lexical/*`
`0.41.0` vs npm latest `0.45.0`. They cannot be upgraded with Payload `3.85.0`:
`pnpm payload generate:importmap` hard-fails with Payload's dependency checker
and explicitly says to change `lexical@0.45.0` back to `0.41.0`.

#### Validation

- Local Node `26.2.0` installed via nvm and used for all repo checks.
- `pnpm install --frozen-lockfile` passed under Node 26 / pnpm `11.5.0`.
- `pnpm payload generate:types` passed.
- `pnpm payload generate:importmap` passed after restoring Payload-required
  Lexical `0.41.0`.
- `pnpm typecheck` passed.
- `pnpm build` passed under Node 26.
- `pnpm registry:check` passed with no drift across 55 `@siab/*` items.
- `pnpm check:responsive` passed.
- `pnpm lint:no-css` passed.
- `pnpm peers check` passed with no peer dependency issues.
- Full `pnpm test` passed, 100 files / 864 tests, using a disposable Podman
  `postgres:18-alpine` container.
- `podman build -t siab-payload-node26-pg18-smoke .` passed.
- The locally built Node 26 image smoke-started against PostgreSQL 18; `/api/health`
  returned `{"status":"ok","db":"connected","dataDir":"writable"}` and boot
  applied all migrations successfully.
- Final `pnpm outdated --format json` reports only the Payload-required Lexical
  hold described above.
- VPS deployment initially exposed PostgreSQL 18's new Docker volume layout;
  compose mounts were corrected from `/var/lib/postgresql/data` to
  `/var/lib/postgresql` before the production restore.

OBS-95 is closed for repo-local code/config. VPS deployment still requires the
normal image publish plus a PostgreSQL 17 -> 18 data migration or pre-use
volume reset before recreating production with the new compose image.


---

## Closed — earlier items

### OBS-55 — CMS canvas CSS sync should be a proper orchestrator step, not site entrypoint — RESOLVED

**Status:** Closed 2026-05-25 · **Layer:** multi-repo (per-tenant site repo entrypoint + future orchestrator)
**Discovered in:** Session 2026-05-18 (during ami-care prod redeploy after Phase D)

#### Description
The CMS canvas reads tenant-specific compiled CSS + font files from `DATA_DIR/tenants/<id>/cms-editor.css` + `/files/*` to render the editor surface with tenant tokens. The Astro build (in each tenant site repo) produces both at `/app/dist/cms/*` via `scripts/build-cms-css.mjs`. Production had no orchestrator step that copied these into the CMS data dir at deploy time, so `site-amicare-zorg` temporarily copied the artifacts from its container entrypoint and required a writable `/data:rw` mount.

#### Resolution
`siab-payload-orchestrator` now defines the deploy-time sync contract instead of relying on writable site containers:
- Added `scripts/sync-cms-artifacts.sh`, which pulls/creates the built site image, copies `/app/dist/cms/*` out of the image, and writes `cms-editor.css` plus `files/*` into `/srv/data/saas/siab-payload/tenants/<tenantId>/`.
- Added `runbooks/cms-artifact-sync.md`.
- Updated the CMS-ification prompt to print the sync command and keep the site compose mount at `/data:ro`.
- Updated `site-converter` and `cms-reviewer` guidance so new conversions no longer generate or require the obsolete `/data:rw` entrypoint copy workaround.
- Removed the old `scripts/docker-entrypoint.sh` workaround from `site-amicare-zorg` and its Dockerfile.

#### Validation
Production Amicare used the new sync path on 2026-05-25. The VPS tenant data dir for tenant 7 contains the synced `cms-editor.css` plus 82 font files, live compose mounts `/srv/data/saas/siab-payload/tenants/7:/data:ro`, `docker inspect ami-care` reports the mount as read-only, and `https://ami-care.nl` / `/healthz` smoke checks pass.

---

### OBS-40 — Existing tenants need a redeploy after OBS-38 multi-repo work lands — RESOLVED

**Status:** Closed 2026-05-25 · **Layer:** multi-repo (deployment / operational)
**Discovered in:** Session 2026-05-16, cross-repo audit
**Depends on:** OBS-38 (must land in `sitegen-template` / `site-amicare-zorg` + `site-orch` + `payload-orch` first)

#### Description
Once OBS-38 shipped dark-mode + role-token plumbing in the site template and the build/deploy contracts in the orchestrators, those changes only reached production tenants via redeploy. The production CMS tenant inventory is currently Amicare only; `amblast` and `siteinabox` are future `/add-cms` conversions, not existing Payload tenants.

#### Resolution
`siab-payload-orchestrator/runbooks/existing-tenant-redeploy.md` records the redeploy checklist and corrected known CMS tenant inventory. Amicare was redeployed on 2026-05-25 from `site-amicare-zorg` commit `c9eb3ce` after the artifact-sync contract landed.

#### Validation
GitHub Actions built and pushed the Amicare image, the VPS pulled/recreated the `ami-care` service, and production smoke checks pass: container health is `healthy`, `https://ami-care.nl` returns HTTP 200, `/healthz` returns `ok`, `Tenant.siteManifest` is populated for tenant 7, block anchors are explicit in the DB and live HTML, tenant-theme CSS is injected, and the `/data` mount is read-only.

### OBS-58 — @siab/canvas-mode + @siab/canvas-mobile should pass manifest to useCanvasBlocks (defaultAnchor pre-fill activation) — CLOSED 2026-05-25

**Status:** Closed · **Layer:** multi-repo (`optidigi/design-systems` → consumed by `siab-payload`)
**Discovered in:** Session 2026-05-18 (OBS-57 implementation — Task 11 of `feat/obs-57-multi-site-type-consumer`)

#### Resolution
`@siab/canvas-chrome` now passes the already-in-scope tenant manifest into both desktop and mobile `useCanvasBlocks(manifest)` call sites. New block inserts therefore receive `manifest.blocks[].defaultAnchor` pre-fill in the actual canvas UI, not only in the lower-level hook tests.

The generated registry item was rebuilt, pulled into `siab-payload`, and pinned with a static regression test covering both registry-owned consumer files.

#### Validation
`pnpm build:siab` passed in `optidigi/design-systems`. In `siab-payload`, focused coverage confirms the hook semantics and registry caller wiring.

#### Related
- OBS-57 (schema + hook half) — Closed
- OBS-54 remains Active for the broader slot-composition refactor; OBS-58 was only the narrow "registry caller can pass host context" instance.

### OBS-72 — Generated sites carry pre-existing `astro check` type errors — RESOLVED

**Status:** Closed 2026-05-22.
**Discovered in:** Session 2026-05-20, Bundle 3 (OBS-42) gating of site-amicare-zorg.
**Files:** `siab-payload-orchestrator/.claude/agents/site-converter.md`, `siab-site-template/src/components/cms/RtNodeRenderer.tsx`

#### Resolution
Fixed both canonical sources that every generated site inherits. The `Blocks.astro` scaffold in `siab-payload-orchestrator` now accepts `MediaRef | undefined` in the media resolver contract, so optional hero images and testimonial avatars no longer trip strict checks. The `siab-site-template` rich-text renderer now narrows link children explicitly instead of reading `children` from an inline union that also includes `linebreak`.

#### Validation
`pnpm astro check` in `siab-site-template` reports 0 errors. Existing hints remain unrelated baseline hints.

---

### OBS-61 — `build-image` CI workflow doesn't smoke-start the container — RESOLVED

**Status:** Closed 2026-05-22.
**Discovered in:** Session 2026-05-18 (OBS-60 retrospective — siab-payload boot deadlock).
**File:** `.github/workflows/build-image.yml`

#### Resolution
The `build-image` workflow now starts a Postgres service and smoke-runs the pushed image after the Docker build. The smoke step runs the normal production entrypoint, waits up to 90 seconds for `/api/health`, fails if the container exits before becoming healthy, and uploads container logs as a workflow artifact. It also scans boot logs for top-level-await failure signals so a future migrate-on-boot bundle deadlock is visible in CI instead of first surfacing on the VPS.

#### Validation
Workflow syntax was reviewed locally. Full container smoke validation requires GitHub Actions because Docker is not installed in the local shell.

---

### OBS-73 — CI actions pinned to deprecated Node 20 (`setup-node@v4`, `pnpm/action-setup@v4`) — RESOLVED

**Status:** Closed 2026-05-22.
**Discovered in:** Session 2026-05-20, Bundle 4 CI run.
**Files:** `.github/workflows/ci.yml`, `.github/workflows/build-image.yml`

#### Resolution
Updated the `ci` workflow from `pnpm/action-setup@v4` to `@v6` and from `actions/setup-node@v4` to `@v6`, matching the current Node 24-capable major lines. The `build-image` workflow already carried the `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` stopgap for the Docker action family, so no additional `setup-node` / `pnpm` pins remained there.

#### Validation
`pnpm typecheck` ✓ · `pnpm lint` ✓ · `pnpm lint:no-css` ✓. Full GitHub workflow execution awaits CI.

---

### OBS-28 — `pnpm lint` is non-functional (no ESLint config) — RESOLVED

**Status:** Closed 2026-05-22.
**Discovered in:** Session 2026-05-11.
**File:** `package.json`, `.eslintrc.json`, `.github/workflows/ci.yml`

#### Resolution
Added explicit ESLint dependencies (`eslint`, `eslint-config-next`, `@typescript-eslint/eslint-plugin`) and a repo-level `.eslintrc.json` extending `next/core-web-vitals`. `pnpm lint` now runs non-interactively and is wired into CI after typecheck.

The current baseline exits 0 with warnings. Two rules that were immediate baseline blockers (`react/no-unescaped-entities`, `react-hooks/rules-of-hooks`) are warning-level for the first operational lint pass; tighten to `--max-warnings 0` only after the existing warning baseline is cleared.

#### Validation
`pnpm lint` ✓ · `pnpm typecheck` ✓ · `pnpm lint:no-css` ✓.

#### Correction — 2026-06-01
This resolution was superseded by the Next 16 upgrade in OBS-94. `next lint`
is no longer a supported command and now fails as an invalid project directory
when invoked through `pnpm lint`. The stale CI step was removed in OBS-94; the
documented required gates are `pnpm typecheck`, `pnpm registry:check`,
`pnpm check:responsive`, `pnpm lint:no-css`, and the full Vitest suite. If this
repo needs ESLint as a required gate again, open a new item to migrate from the
old Next lint wrapper to a supported ESLint 9 flat-config setup.

---

### OBS-39 — `--destructive-surface` token for dark-mode Danger Zone contrast — RESOLVED (obsolete)

**Status:** Closed 2026-05-20 — obsolete, not pursued.

Closed per operator (2026-05-20): the current dark-mode Danger Zone contrast is acceptable as-is, so the dedicated `--destructive-surface` registry token is no longer needed. The R10-era concern (`bg-destructive/5` ≈ 1.05:1 over the dark `--background`) no longer warrants a token addition — `PageForm.tsx`'s Danger Zone card stays on `border-destructive/50 bg-destructive/5`. Re-file if a future palette retune regresses the contrast.

---

### OBS-70 — Five integration test files bypass `getTestPayload()`, fail on a fresh CI DB — RESOLVED

**Status:** Closed 2026-05-20 (discovered + fixed same session).
**Discovered in:** Session 2026-05-20 — investigating why the `ci` workflow had been red on `main` for ~9 consecutive commits.

#### What it was
Five `tests/integration/*` files — `migrate-restore-roundtrip`, `pageRtValidation`, `migrate-amicare`, `blockMenuEnforcement`, `tenantManifest` — bootstrapped Payload with `getPayload({ config })` directly instead of `getTestPayload()` (`_helpers.ts`). Only `getTestPayload()` runs `migrateFresh` to build the schema; the five direct callers assumed a schema already existed.

#### Why it surfaced now (latent for months)
The gap was masked by Payload dev-mode push — `getPayload()` under vitest used to auto-sync the schema, so even the direct callers got tables. I-1 (`a1a0d65`, nav backend) disabled push under VITEST (`push: false` when `process.env.VITEST`, itself an OBS-66 follow-up), removing the safety net. From that commit on, CI's fresh Postgres service container had no schema for whichever direct-`getPayload` files the vitest sequencer placed before the first `getTestPayload()` file → `42P01 relation "tenants" does not exist` in `beforeAll`. `migrate-restore-roundtrip` + `pageRtValidation` lost that ordering lottery every run. Local `pnpm test` stayed green because the local `payload_test` DB is warm (schema persists from prior runs) — the textbook OBS-29 / OBS-66 test-DB-rot signature.

#### OBS-66 residual
OBS-66 added `migrateFresh` to `getTestPayload()` but never migrated these five files onto the helper, so its guarantee never reached them.

#### Resolution
All five files routed through `getTestPayload()`. Each now runs `migrateFresh` in `beforeAll`, so every integration file has a migrated schema regardless of vitest's file order. Reproduced locally by recreating `payload_test` empty (mirrors CI's fresh Postgres) — the two formerly-failing files then `42P01`'d; after the fix the full suite is 744-green against a fresh DB.

---

### OBS-69 — RT json fields had stale `required: true` vs nullable migration columns — RESOLVED (dropped `required`)

**Status:** Closed 2026-05-20 · **Resolved by:** `fix/obs-69-rt-required` (migration `20260520_061420_drop_rt_field_required`).
**Discovered in:** Session 2026-05-20 (dev server push-init failure while smoking I-2).

#### What it actually was
Not just `CTA.headline` — **6** rich-text json fields carried a stale `required: true`: `CTA.headline`, `Hero.headline`, `RichText.body`, `FAQ.question`, `FAQ.answer`, `FeatureList.features[].title`. The rt-v2 migration (`20260513_180426_rt_v2_fields`) converted these columns to `jsonb` and `DROP`ped NOT NULL — and never re-added it; its own comment states the intent ("the new collection schema treats RT fields as optional"). The block configs were never updated to match, so:

- **Prod DB** (migration-built): columns **nullable** — `required` enforced nowhere.
- **Config**: `required: true` (claims non-null).
- **Migration `.json` snapshot**: auto-claimed `notNull: true` (mirrors config) — so `migrate:create` could never see the drift.
- **Dev push-mode**: diffs config vs the live DB → tries `SET NOT NULL` → fails on any legitimately-null row. This was the proximate cause of the OBS-68 dev-server init failures.

The whole downstream stack already tolerated null RT fields: `validateRichTextOnSave` skips null (`value == null` → continue, validates structure only when present), `pageToJson` passes null through verbatim, and the site `types.ts` already types these `RtRoot | null`. `required: true` was also a weak guarantee — it only catches literal `null`, never an empty `{root:{children:[]}}` RtRoot.

#### Resolution
Dropped `required` from the 6 json fields (operator-confirmed over the backfill+NOT-NULL alternative — that would inject placeholder content into prod and still not guarantee non-empty RtRoots). Regenerated types. Shipped `20260520_061420_drop_rt_field_required` recording the 6 columns as nullable (`down()` throws — re-adding NOT NULL would break on null rows, the exact failure being fixed). No prod data touched: prod's null rows are now legal. CI green — typecheck, 744 tests (`migrateFresh` exercises the new migration cleanly), `lint:no-css`, `registry:check`.

---

### OBS-68 — Local dev CMS login intermittently failed — RESOLVED (not an auth bug; symptom of dev-server Payload-init failure)

**Status:** Closed 2026-05-20 (investigated — no code fix needed).
**Discovered in:** Session 2026-05-20 (attempting to browser-smoke the I-2 navigation page).

#### Investigation
Login is **healthy**. Evidence:
- `POST /api/users/login` with a wrong password for a real user returns a clean `401` + `{"errors":[{"message":"The email or password provided is incorrect."}]}` — the request routes through middleware, Payload is initialised, the login operation runs, the hash comparison runs. The whole login path is exercised.
- The three users (`admin@optidigi.nl`, `orchestrator@optidigi.nl`, `editor+amicare-zorg@optidigi.nl`) all have intact `hash` + `salt`; sessions rows exist.
- The operator did authenticate successfully and smoke-tested I-2.

The "rate-limit lockout" hypothesis is **wrong**: `src/middleware.ts` scopes the audit-p1 #5 rate-limiter to `/api/forms` and `/api/users/forgot-password` only — `/api/users/*` (including login) is explicitly out of scope. Login can't be rate-limited.

#### Root cause
Not an auth bug — a **symptom of the dev server's Payload failing to initialise**. Twice this session the dev server (restarted against the prod-restored, push-mode `payload` DB after the I-1 schema change) could not init:
1. The push schema-rename prompt (`navigation → navHeader/navFooter`) — an interactive prompt with no TTY, hanging init.
2. After the nav migration was applied to the dev DB, `payloadInitError` on `ALTER COLUMN pages_blocks_cta.headline SET NOT NULL` (OBS-69 — a null CTA headline).

While Payload init is failed, **every route 500s / hangs** — including `/login` and `/api/users/login`. The operator's "can't log in" landed in one of those windows. Once the dev DB was migrated + the null CTA headline patched, init succeeded and login worked. The "intermittent" was binary: gated on whether Payload initialised, not flaky auth.

#### Resolution
No code change — login is correct. The underlying fragility (prod-restored, push-mode dev DB breaks `getPayload()` init whenever the schema evolves) is already captured: push is disabled under vitest (I-1, `payload.config.ts`), OBS-66 tracks test-DB migration state, OBS-69 tracks the CTA-headline data integrity. A standing recommendation for the dev environment: after any schema-changing merge, apply the new migration(s) to the dev `payload` DB before restarting the dev server (as was done for the nav migration this session).

---

### OBS-31 — CI fails on every `@siab` registry 5xx (no retry on `registry:check`) — RESOLVED

**Status:** Closed 2026-05-19 (Bundle H).
**Originally Active in:** Session 2026-05-12 — three consecutive `ci` runs failed on push to `main`.
**Files:** `scripts/registry-check.mjs` (new), `package.json` `scripts.registry:check`.

#### Resolution
The inline `pnpm dlx shadcn@latest add ... && git diff` chain was extracted into `scripts/registry-check.mjs` (mirrors the `scripts/check-no-css.mjs` pattern). The script wraps each of the three `shadcn add` invocations with bounded retry — 3 attempts, exponential backoff (1s / 2s / 4s) — so a transient Cloudflare 522 / 5xx / network flake retries instead of failing the whole `ci` workflow. Retrying a `shadcn add` is safe: a successful add is idempotent.

Drift detection (the final `git diff --exit-code`) is **not** retried — a diff is a real result, not a transient fault. Exit codes distinguish the two failure modes per the suggested-fix shape: `1` = drift detected (committed `@siab/*` files differ from the registry), `2` = registry unreachable after retries exhausted. Both print an actionable message.

`package.json` `scripts.registry:check` is now just `node scripts/registry-check.mjs`. The CI workflow's `Registry drift check` step is unchanged (still calls `pnpm registry:check`) — the retry is transparent to it.

The `actions/cache@v4` manifest-caching alternative from the suggested fix shape was not pursued — retry alone closes the false-positive-failure concern with far less surface; caching can be added later if registry latency becomes a CI-time problem.

Verified: `pnpm registry:check` against the live registry → `passed — no drift across 53 @siab/* items`, exit 0.

---

### OBS-59 — themedMatchers.ts (types) shadows themedMatchers/ directory under bare-path TS resolution — RESOLVED

**Status:** Closed 2026-05-19 (Bundle H).
**Originally Active in:** Session 2026-05-18 (OBS-57 Task 3 — themed-matcher registry reorganisation).
**Files:** `src/lib/richText/themedMatchers/types.ts` (new, was `themedMatchers.ts`), `themedMatchers/index.ts`, `themedMatchers/amicare/{eyebrow,index}.ts`, `PastePlugin.tsx`, `tests/unit/mapper-themed.test.ts`, `tests/unit/richText/themedMatchers.test.ts`.

#### Resolution
The shadowing sibling file `src/lib/richText/themedMatchers.ts` (which held `ThemedMatcher` + `P5Element` types) was moved into the directory as `themedMatchers/types.ts` and the old file deleted. The directory's `index.ts` now re-exports the type primitives (`export type { ThemedMatcher, P5Element } from "./types"`) so consumers using the bare directory path keep working.

Caller updates:
- `themedMatchers/index.ts` + `amicare/eyebrow.ts` + `amicare/index.ts` — type imports retargeted from the deleted sibling to `./types` / `../types`.
- `PastePlugin.tsx`, `mapper-themed.test.ts`, `richText/themedMatchers.test.ts` — dropped the `/index` workaround suffix; `@/lib/richText/themedMatchers` now resolves to the directory's `index.ts` correctly (no sibling `.ts` to shadow it).
- `mapper.ts` — unchanged; its bare-path `import type { ThemedMatcher } from "./themedMatchers"` now resolves to the directory index's re-export.

Verified: typecheck clean, full suite 708/708.

---

### OBS-19 — Integration and unit tests do not run in CI — RESOLVED

**Status:** Closed 2026-05-19 (Bundle F).
**Originally Active in:** Session 2026-05-11 — review of `.github/workflows/ci.yml`.
**File:** `.github/workflows/ci.yml`

#### Resolution
Added a `test` job to `.github/workflows/ci.yml` running in parallel with `typecheck-and-registry-drift`. Postgres 17 service container provisions `payload_test` directly (matches what `tests/setup.ts` swaps to, so the override is a no-op for matching paths). Job runs:
1. Install + Node + pnpm setup (mirror the typecheck job)
2. `pnpm payload generate:types` + `generate:importmap` (against the real CI Postgres URL — generate doesn't connect, but the URL needs to satisfy the config import)
3. `pnpm test` — full vitest suite (unit + integration; vitest.config.ts includes both)

Env: `PAYLOAD_SECRET=ci-test-secret`, `DATABASE_URI=postgres://payload:ci-password@localhost:5432/payload_test`, `PAYLOAD_DISABLE_JOBS_AUTORUN=1` (quiet the cron worker registered in payload.config.ts).

Local verification: `pnpm test` against the live `payload_test` DB reports **688 passed / 0 failed (77 test files)**. Includes the previously-failing `tenant-isolation.test.ts:90-97` which now passes because OBS-67 (canWrite tenant membership) shipped first.

Blocked on:
- OBS-29 (test suite green on main) — closed by Bundle E
- OBS-66 (test setup migrations) — closed in this same bundle below
- OBS-67 (security bug surfaced by enabling integration tests) — closed prior to this bundle

CLAUDE.md § Testing + the top-of-file Commands block updated to reflect: `pnpm test` now runs the full suite (was documented as "unit only"), `pnpm test tests/unit/` runs the unit subset.

---

### OBS-66 — `tests/setup.ts` doesn't bring `payload_test` to a known migration state — RESOLVED

**Status:** Closed 2026-05-19 (Bundle F).
**Originally Active in:** Session 2026-05-19 (narrowed residual from OBS-29 during Bundle E).
**Files:** `tests/integration/_helpers.ts`, `src/migrations/*.ts` (16 files), `CLAUDE.md` § Testing.

#### Resolution
`tests/integration/_helpers.ts:getTestPayload()` now calls `payload.db.migrateFresh({ forceAcceptWarning: true })` once per process — caches behind `cachedPayload`, runs at the first integration test's first call, drops + reapplies all committed migrations. Production-behaviour parity: schema comes from migration files, not push-mode auto-sync, and the `payload_migrations` table is populated with the real entries (no more meaningless "dev" placeholder).

`seedFixture()` already existed (t1/t2 tenants + super-admin/owner/editor/viewer users) and wasn't recreated. `resetTestData()` continues to wipe data between tests for isolation; the two concerns layer cleanly (migrateFresh = schema, resetTestData = data).

**Surfaced and fixed in lockstep:** vitest's vite-node dynamic-import couldn't resolve the migration files' value+type mixed imports — `import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'` is value+type mixed but `MigrateUpArgs`/`MigrateDownArgs` are type-only exports from that package. Production CLI strips types at transpile time, so it worked there. Vitest's import path didn't strip them and threw `"does not provide an export named 'MigrateDownArgs'"`. Fixed across all 16 migration files via mechanical sed:
- `import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'`
- → `import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'`
- → `import { sql } from '@payloadcms/db-postgres'`

This is canonically correct regardless of vitest — `import type` for type-only imports is best practice with `isolatedModules: true` (set in tsconfig.json). Future migrations generated by `pnpm payload migrate:create` will likely have the same shape and need the same fix at generation time; consider a `lint:no-css`-style rule to enforce.

#### Cross-reference
- OBS-29 (closed by Bundle E) — supersedes the unit-test slice of this concern.
- OBS-19 (tests in CI) — closed in this same bundle above; together they close the test/prod drift loop.
- OBS-67 (canWrite tenant membership) — discovered when integration tests started running cleanly; fixed in its own commit prior to this bundle.

---

### OBS-29 — `payload_test` DB has unrun migrations + missing seed data, 16 tests fail on main — RESOLVED (different root cause than originally diagnosed)

**Status:** Closed 2026-05-19 (Bundle E — test suite repair).
**Originally Active in:** Session 2026-05-11 (during finishing-a-development-branch verification gate)
**Files:** `tests/unit/audit-p1-8-pages-tenant-slug-unique.test.ts`, `tests/unit/audit-p3-15-media-tenant-filename-unique.test.ts`, `src/hooks/ensureUniqueTenantSlug.ts` (new), `src/hooks/ensureUniqueTenantFilename.ts` (new), `src/collections/Pages.ts`, `src/collections/Media.ts`, `tests/integration/orchestrator-api.test.ts`

#### Resolution
Root cause was **not** missing DB seed data or unrun migrations — the failing tests are unit tests that mock `req.payload.find`. The actual cause was tests using `beforeValidateHooks[0]` (positional array access) to grab their target hook. When `validateTenantExists` was prepended to both `Pages.hooks.beforeValidate` and `Media.hooks.beforeValidate` in commit `ee4eacd8` (2026-05-10), `[0]` started returning the wrong hook, which was then called against a `req` mock missing `findByID` and threw `"Tenant not found"`. The DB-seed framing in the original entry mistook the symptom for the cause.

The structural fix matches the canonical Payload v3 hook-testing pattern (verified via repo audit + Payload internals + context7 docs): hooks live in `src/hooks/*.ts`, exported by name; tests import the function reference directly. The two inline `const` hooks (`ensureUniqueTenantSlug` in `Pages.ts:50`, `ensureUniqueTenantFilename` in `Media.ts:30`) were the only outliers from this convention — the other 7+ beforeValidate hooks in the codebase (`validateTenantExists`, `validateRichTextOnSave`, `enforceTenantBlockMenu`, etc.) already follow it.

**Bundle E changes:**
1. Extracted `ensureUniqueTenantSlug` → `src/hooks/ensureUniqueTenantSlug.ts` (export). Pages.ts imports.
2. Extracted `ensureUniqueTenantFilename` → `src/hooks/ensureUniqueTenantFilename.ts` (export). Media.ts imports.
3. Both audit tests now `import { hookName } from "@/hooks/..."` and call the function directly. The S1 wiring-check still verifies `beforeValidateHooks.toContain(hookName)` so registration regressions still trip, but position within the array is intentionally NOT asserted (order-independent — robust to future hook additions in front).
4. Fixed `tests/integration/orchestrator-api.test.ts:31` stale RT-v2 fixture — `headline: "Welcome"` (plain string) replaced with a valid inline-variant RtRoot tree, matching Hero block's `editor: "richTextInline"` declaration.
5. Closed OBS-65 in lockstep (the 16th pre-existing failure — `RtStaticView` test asserting a removed `rt-placeholder` class — was an unrelated assertion-rot; updated to match the current `text-muted-foreground` in-flow render).

**Verification:** `pnpm test tests/unit/` reports `633 passed / 0 failed` from Bundle E (was `617 / 16 failed` immediately prior on `main` HEAD `0cd9d23`).

**Narrowed residual:** OBS-29 also mentioned (correctly, in passing) that `tests/setup.ts` doesn't bring `payload_test` to a known migration state, and that integration tests would benefit from a shared seed helper. That concern survives — but it's a separate test-infrastructure improvement, not part of the 16 unit-test failures. Filed as OBS-66 above.

---

### OBS-65 — `RtStaticView` empty-placeholder test asserts a class the component no longer emits — RESOLVED

**Status:** Closed 2026-05-19 (Bundle E — closed in lockstep with OBS-29).
**Originally Active in:** Session 2026-05-19 (Bundle A backend-safety-quartet verification gate, filed as an incidental discovery)
**File:** `tests/unit/RtStaticView.test.ts:142-148`

#### Resolution
The assertion at line 144 asserted `"rt-placeholder"` against a component branch that deliberately renders `<span class="text-muted-foreground">…</span>` instead — `rt-placeholder` is `position: absolute` (used by `LexicalField`'s editing placeholder), and using it in `RtStaticView`'s in-flow empty-value branch would float the placeholder above the canvas hover outline. The component design comment at `RtStaticView.tsx:157` calls this out explicitly.

Bundle E updated the assertion to match the deliberate render (`text-muted-foreground` + `Headline…`) and added a comment pointing to the design-intent note in the component file, so future readers don't try to "fix" this by reintroducing the class. No component change required.

---

### OBS-38 — Live site honors `theme.mode` + `theme.darkPalette` + new font/radius role tokens (CLOSED 2026-05-19 — implemented via `:root`-collapse)

**Resolved by:** A different mechanism than the original spec proposed. The end-to-end chain ships and works:

1. Operator picks dark mode in the CMS theme toolbar → `tenant.theme.mode = "dark"` (optionally with `darkPalette` overrides) is persisted.
2. `projectThemeOnChange` hook (`src/hooks/tenantLifecycle.ts:104-110`) fires on save → calls `projectTenantTheme()`.
3. `toCssVars(theme, ":root")` (`src/lib/projection/toCssVars.ts:93-115`) — when `scope === ":root"` AND `theme.mode === "dark"`, the `flatten` branch activates and **collapses light + dark into a single `:root { ... }` rule** with the dark palette values (or `DEFAULT_DARK` fallback) baked in directly. No `html[data-rt-mode="dark"]` overlay is emitted; the dark values simply become the new `:root` baseline for that deployment. Palette tokens, `--font-{title,heading,text}`, and `--radius-{sm,md,lg}` all flow through the same collapse.
4. `tenant-theme.css` is written to disk.
5. `site-amicare-zorg/src/layouts/BaseLayout.astro:22-46` reads `tenant-theme.css` from `CMS_DATA_DIR` on every SSR render and injects it as `<style data-tenant-theme>` in `<head>`. Tailwind v4's `@theme` block in `global.css` generates `bg-bg`, `text-ink`, etc. utilities from those `:root` tokens; all consumers paint with the right values.

The original spec called for an `html[data-rt-mode="dark"]` overlay + `data-rt-mode` stamp on `<html>` from Astro. The shipped implementation skips the attribute entirely because the site is rendered statically/per-request to whatever its active mode is — no runtime toggle, so no overlay needed. Same outcome, simpler mechanism.

**Original status:** Active · **Layer:** multi-repo. Filed 2026-05-15 (Rich Text v2 Phase 3 R4 scope-out). Closed during 2026-05-19 backlog audit after operator confirmed live-site theme propagation works visually.

**Operational note:** verify `CMS_DATA_DIR` in production points at the per-tenant directory containing `tenant-theme.css` (or has a symlink/sync mechanism). The fact that theme changes propagate visually confirms the wiring is correct in the current deploy, but worth documenting if not already.

---

### OBS-36 — Add `collapsible` to the `@siab` registry — CLOSED 2026-05-19 (stale)

**Closed as stale.** The entry was filed 2026-05-14 during Rich Text v2 Phase 3 brainstorm when the proposed sidebar UI was a "Shopify-style sections tree" — a list of expandable section cards that would have needed a `@siab/collapsible` primitive for the per-row expand/collapse state. By the time Phase 3 actually shipped, the sidebar was rewritten as a **drill-down** pattern instead: `src/components/ui/sidebar-drill-down.tsx` manages three modes (`"list"` | `{ kind: "block" }` | `"page-settings"`) with `useState<Mode>` and a tightly-coupled slide-in-from-right animation. The original sections-tree use case evaporated and the drill-down doesn't need `@siab/collapsible` — the mode-state machine and its transition animation are inseparable and correctly live in-app per the "UI primitives belong with their logic when they're inseparable" framing.

The `@siab/popover` half (originally bundled in this entry) had already landed in the `registry:check` add-list. No work remains; close.

If a future surface (e.g. a sections-tree pattern resurfaces) needs `@siab/collapsible`, file a fresh entry at that point.

---

### OBS-35 — Canvas tenant CSS: `@font-face` URLs are relative, 404 in the CMS editor (CLOSED 2026-05-19)

**Resolved by:** Commit `d2b772a` (2026-05-16) — implemented candidate fix #1 (absolute CMS route + URL rewrite) with operational refinements.

- New CMS route at `src/app/(payload)/api/tenant-assets/[tenantId]/[...path]/route.ts` serves tenant-scoped static assets (fonts, css, images) from `DATA_DIR/tenants/<tenantId>/<path>`. Path-traversal guarded; `Access-Control-Allow-Origin: *` + immutable cache headers (`max-age=31536000`).
- `rewriteAssetUrls()` in `src/lib/editor/loadTenantCss.ts:271-283` transforms relative `url(./files/...)` / `url(/files/...)` to `url(/api/tenant-assets/<tenantId>/files/...)` in both the scoped CSS body and `@import` headers. Skips protocol-absolute URLs and data URIs; idempotent.
- Build pipeline updated to copy `.woff2` files from `node_modules/@fontsource-variable/*/files/` into `DATA_DIR/tenants/<id>/files/` alongside `cms-editor.css`.

Followups (`e2c9984` inspector inputs inherit tenant fonts; `061ded1` tenant colors re-emitted to admin scope; `b819c30` `@import` scanner robustness) stabilised the surface during Phase 2 and Phase 3.

**Original status:** Active · **Layer:** multi-repo. Filed 2026-05-14 (Phase 2 canvas-mode smoke test). Closed during 2026-05-19 backlog audit.

---

### OBS-60 — siab-payload boot deadlock from circular import in enforceTenantBlockMenu (CLOSED 2026-05-18)

**Layer:** `siab-payload` (esbuild-bundled migrate-on-boot)
**Discovered in:** Session 2026-05-18, OBS-56 prod deployment (post-merge `c699678`)
**Resolved by:** commit `437ef9f` (`fix(hooks): defer loadManifest import in enforceTenantBlockMenu (boot hang)`)

#### Problem
The OBS-57 implementation added `src/hooks/enforceTenantBlockMenu.ts` with a top-level static import of `loadTenantManifest` from `@/lib/richText/loadManifest`. This closed a circular module-init cycle under esbuild's `__esm` bundling:

```
payload.config → Pages → enforceTenantBlockMenu → loadManifest → payload.config
```

In `dist-runtime/migrate-on-boot.bundled.mjs`, the inner `await init_payload_config()` (line 222455, generated for loadManifest's static import) returned the outer's (line 224999, the entry's static import) still-pending init Promise. Result: both Promises waited on each other forever. Node detected an unsettled top-level await, printed the warning, exited code 13. Container restart-looped indefinitely under `restart: unless-stopped`.

CI passed because `pnpm typecheck` and the Docker `build-image` job don't exercise container start. The hang only surfaces at runtime when the bundled migrate-on-boot script actually runs.

Prod was rolled back to image SHA `c8f08a9c...` by digest-pinning `docker-compose.yml` (backup at `docker-compose.yml.bak-pre-obs57-deploy-<ts>`), then redeployed with the fix.

#### Resolution
Single-file fix: changed `enforceTenantBlockMenu.ts` to use `await import("@/lib/richText/loadManifest")` inside the hook body, mirroring the deferred-import pattern already documented in `validateRichTextOnSave.ts`. Added a paragraph-length comment explaining the cycle so future contributors don't repeat it.

Bundle inspection confirmed the fix: post-fix, `init_loadManifest()` is invoked ONLY via the dynamic-import gate (`init_loadManifest().then(...)`), never at module-init time. The cycle is broken.

#### Aftermath
- Convention is now documented in TWO hook files (`validateRichTextOnSave.ts` original + `enforceTenantBlockMenu.ts` new). Any future hook that needs `loadTenantManifest` MUST use deferred dynamic import.
- **CI gap surfaced:** the `build-image` workflow doesn't smoke-start the container. A future improvement would add a post-build job that runs the image against a throwaway Postgres + curls `/api/health`, failing CI if the container can't reach healthy in ~90s. Now tracked separately as OBS-61.
- Reinforces the OBS-29 / OBS-19 thread: integration coverage of the actual boot path would have caught this in CI, not prod.

---

### OBS-30 — Unlayered `*` rule in globals.css beats `border-*` Tailwind utilities (CLOSED 2026-05-17)

**Layer:** frontend
**Discovered in:** Session 2026-05-11 (during FE-15 v2 visual smoke)
**Resolved by:** commit `fe949ff chore(globals): adopt @siab/base — add base layer resets, preserve font-family (D2)` (Phase D2 of FE-46).

#### Problem
`src/styles/globals.css:151` used to contain an unlayered universal rule (`* { border-color: var(--border); }`). Because the rule sat outside any `@layer`, it beat every `@layer utilities`-scoped `border-*-color` utility (`border-foreground/50`, `border-primary/20`, `border-ring/30`, etc.), making every Tailwind border-color utility silently no-op throughout the project. FE-15 v2 originally surfaced the bug — the visible border on `.border-foreground/50` rendered at the `--border` token, not `color-mix(in oklab, var(--foreground) 50%, transparent)`. The structural fix was blocked because globals.css was registry-owned and any local layering change would fail `pnpm registry:check`.

#### Resolution
Phase D2 adopted `@siab/base` as the registry source-of-truth for the base layer. The new `globals.css` (lines 310-312) places the universal rule inside `@layer base { * { @apply border-border outline-ring/50; } }`. The rule is now in the same cascade tier as Tailwind's `@layer utilities`, so per-element `border-*-color` utilities correctly win on specificity. The `ring-*` workaround added for FE-15 (`ring-2 ring-inset ring-foreground/50`) can be migrated back to `border-*` if the simpler form is preferred — left as-is because the ring approach is forward-compatible.

---

### OBS-53 — VPS publish of 15 sub-phase 1-8 items (CLOSED 2026-05-18)

**Layer:** multi-repo (`optidigi/design-systems` VPS publish → `siab-payload` CI)
**Discovered in:** Session 2026-05-17, Phase B.4 implementation attempt
**Spec (historical):** `docs/superpowers/specs/2026-05-17-phase-b4-registry-check-extension-design.md`

#### Original problem
Phase B.3 extracted 15 `@siab/*` items from the registry source into design-systems but never published them. Their `registryDependencies` already referenced sibling items via `@siab/foo` (production URLs), so shadcn CLI couldn't resolve transitive deps locally without a workaround. B.4 (`registry:check` extension) + D3 + D4 + D5a were all gated on the publish + a working local-validation flow.

#### Resolution
Both halves landed during session 2026-05-18:

1. **Local-validation infrastructure** (cross-dep blocker workaround): components.json `@siab` retargeted to `http://localhost:8443/r/v1/siab/{name}.json` for the validation window, then reverted before commit. Single-gate `registry:check` covering all 53 items (38 originals + 15 sub-phase + onboarding-checklist), no `@siab-local` parallel script.

2. **Production publish**: design-systems pushed + Docker rebuild on `registries.optidigi.nl` deployed all 16 items publicly. siab-payload then ran `registry:check` against the prod URL cleanly. Followed by:
   - B.4 — single extended `registry:check` (commit `7ef1200`)
   - D3 — `.rt-content*` migrated to `@siab/rich-text-toolbar` (design-systems `2f6bdc0` + siab-payload `ce432cb`)
   - D4 — full `.rt-canvas*` surface migrated to `@siab/canvas-chrome` (design-systems `daecf30` + siab-payload `6a60384`)
   - D5a — new `@siab/onboarding-checklist` extraction (design-systems `c6ff6df` + siab-payload `00122ff`)

#### Aftermath
- Local-mirror workflow stays as the canonical pre-publish validation pattern (memory: [[local-registry-validation-workflow]]); use whenever new registry items have unpublished sibling deps.
- The cross-dep concern is structural to the registry: a future composability refactor (OBS-54) could reduce the "all sub-phase items must publish at once" coupling.
- Rich text v2 prod migration completed in the same session: schema migration applied + ami-care content repopulated from on-disk projection snapshot via `scripts/repopulate-richtext-from-snapshot-entry.ts` (one-off recovery tool).

---
