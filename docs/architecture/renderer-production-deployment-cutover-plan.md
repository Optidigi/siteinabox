# Renderer Production Deployment And Staging Cutover Plan

Date: 2026-06-26

This is the execution plan for deploying the current data-driven Site in a Box
work far enough to prove the remaining production path, while explicitly
leaving full intake and automated domain/DNS purchasing/proxy provisioning out
of scope.

No production mutation is authorized by this document. Each implementation phase
requires operator approval before code changes, image pushes, production `.env`
edits, migrations, compose changes, or route changes.

## Target

- Replace Resend with Cloudflare Email Service for Payload and Better Auth
  transactional email, unless Better Auth Infrastructure is explicitly chosen
  later for auth-only email after a separate approval.
- Set real production env/secrets on the VPS without committing secret values.
- Deploy the new generic `apps/renderer` image/stack.
- Preserve original `Host` and `X-Forwarded-Host` through Traefik.
- Run Payload migrations in production after backup.
- Keep existing legacy Amicare and Amblast containers deployed.
- Temporarily prove renderer-backed Amicare and Amblast through:
  - `https://amicare.optidigi.nl`
  - `https://amblast.optidigi.nl`
- Smoke-test preview magic link, Mollie checkout/webhook,
  publish/activate/rollback, and renderer host lookup.

## Explicitly Out Of Scope

- Full intake product implementation.
- KVK enrichment and intake business-rule completion.
- OpenProvider domain purchase automation.
- Cloudflare DNS/proxy automation for customer domains.
- Final migration of `ami-care.nl` or current Amblast production traffic to the
  renderer.
- Removing legacy `sites/ami-care` or `sites/amblast` containers.
- Generating tenant source files, tenant folders, workflows, or images.

## Current Repo Facts

- `apps/cms` has a production Dockerfile and compose template.
- `apps/landing` has replaced the old `apps/site` source path, while the image
  name remains `ghcr.io/optidigi/siteinabox-site`.
- `apps/intake` exists as a separate app boundary, but the full intake product
  is still operator-owned/in progress.
- `apps/renderer` has a production Dockerfile, compose template, health route,
  and GHCR build workflow for `ghcr.io/optidigi/siteinabox-renderer`.
- Existing legacy tenant images still exist:
  - `ghcr.io/optidigi/siteinabox-site-ami-care`
  - `ghcr.io/optidigi/siteinabox-site-amblast`
- CMS mail now uses `apps/cms/src/lib/email/sendEmail.ts`; Cloudflare SMTP is
  wired through `apps/cms/src/payload.config.ts` when
  `CLOUDFLARE_EMAIL_SMTP_TOKEN` is set.
- Current CMS payment code is Mollie-based and provider-specific where intended:
  - `apps/cms/src/lib/payments/mollieAdapter.ts`
  - `apps/cms/src/lib/payments/molliePayments.ts`
  - `apps/cms/src/app/(payload)/api/payments/mollie/webhook/route.ts`
- Current renderer snapshot flow is data-driven:
  - renderer loads `GET /api/renderer/snapshot?host=<host>` from CMS;
  - CMS requires `SIAB_RENDERER_API_TOKEN` in production;
  - renderer fixture fallback is ignored in production;
  - renderer serves active published snapshots, not draft CMS state.

## Current Production VPS Facts

Read-only inspection was performed over `ssh prod` as `serveradmin` on
`prod-server` at `2026-06-26T16:15:46+02:00`.

Current stack files:

- `/srv/saas/infra/stacks/siteinabox/apps/cms/compose.yml`
- `/srv/saas/infra/stacks/siteinabox/apps/cms/.env`
- `/srv/saas/infra/stacks/siteinabox/apps/site/docker-compose.yml`
- `/srv/saas/infra/stacks/siteinabox/tenants/amblast/compose.yml`
- `/srv/saas/infra/stacks/siteinabox/tenants/amblast/.env`
- `/srv/saas/infra/stacks/siteinabox/tenants/ami-care/compose.yml`
- `/srv/saas/infra/stacks/siteinabox/tenants/ami-care/.env`
- `/srv/ops/infra/stacks/traefik/compose.yaml`

Running SIAB containers:

| Container | Image | State |
| --- | --- | --- |
| `siteinabox-cms` | `ghcr.io/optidigi/siteinabox-cms:latest` | healthy |
| `siteinabox-cms-postgres` | `postgres:18-alpine` | healthy |
| `siteinabox` | `ghcr.io/optidigi/siteinabox-site:latest` | healthy |
| `ami-care` | `ghcr.io/optidigi/siteinabox-site-ami-care:latest` | healthy |
| `amblast` | `ghcr.io/optidigi/siteinabox-site-amblast:latest` | healthy |
| `traefik` | `traefik:v3.6` | running |

Current Traefik route smoke through local Traefik:

| Host | Observed |
| --- | --- |
| `admin.siteinabox.nl` | `307` |
| `preview.siteinabox.nl` | `404` |
| `siteinabox.nl` | `200` |
| `www.siteinabox.nl` | `404` |
| `ami-care.nl` | `200` |
| `amicare.optidigi.nl` | `404` |
| `amblast.siteinabox.nl` | `200` |
| `amblast.optidigi.nl` | `404` |

Current production CMS route labels include only:

- `admin.siteinabox.nl`
- `admin.ami-care.nl`

Current legacy tenant route labels:

- `ami-care.nl` routes to the legacy `ami-care` container.
- `amblast.siteinabox.nl` routes to the legacy `amblast` container.

No renderer stack exists under `/srv/saas/infra/stacks/siteinabox/apps/`.

Current production CMS `.env` key inventory is missing the new runtime keys:

- no `SIAB_RENDERER_API_TOKEN`
- no `SITE_URL`
- no `MOLLIE_*`
- no `BETTER_AUTH_SECRET`
- no `BETTER_AUTH_PREVIEW_SECRET`
- no Cloudflare Email Service keys

Before the local Phase 1 mail-path change it still contained `RESEND_API_KEY`;
the VPS/production env must be updated separately and was intentionally not
changed by the local implementation.

Agents must not edit the current production `.env`. The production `.env` is
operator-owned secret state; agents may document required keys, produce
templates, and review redacted key inventories only. Any real production
secret update requires the operator to set values directly on the VPS or in the
approved secret store and then explicitly approve the deploy step that consumes
them.

Current worker-visible CMS env baseline from `apps/cms/.env` was inspected by
key name only; secret values were not copied into this plan.

| Area | Current key/status | Phase 3 production status |
| --- | --- | --- |
| Postgres | `DATABASE_URI` present locally; production compose derives it from `POSTGRES_PASSWORD` | Keep. Retain the existing production database and password. |
| Payload | `PAYLOAD_SECRET` present locally | Keep. Retain the existing production value. |
| Data path | local `DATA_DIR` present; production uses `DATA_HOST_PATH=/srv/data/saas/siab-payload` | Keep production path stable. Do not move tenant data. |
| Super admin domain | `NEXT_PUBLIC_SUPER_ADMIN_DOMAIN=siteinabox.nl` present locally; production template uses `SUPER_ADMIN_DOMAIN=siteinabox.nl` | Keep. |
| VPS IP | not present in local `.env`; production template uses `VPS_IP=<operator value>` mapped to `NEXT_PUBLIC_VPS_IP` | Required for onboarding/DNS guidance. Keep current production VPS IP. |
| PostHog | `POSTHOG_HOST` and `POSTHOG_PUBLIC_HOST` present locally; project token/id/API key not present locally | Keep existing production PostHog configuration. Add missing production PostHog keys only if analytics/admin sync requires them. |
| Better Auth main secret | `BETTER_AUTH_SECRET` present locally | Required. In production use a dedicated high-entropy value; do not rely on fallback to `PAYLOAD_SECRET`. |
| Better Auth preview secret | not present locally | Likely required for isolated preview sessions. Set `BETTER_AUTH_PREVIEW_SECRET`. |
| Better Auth Infrastructure | `BETTER_AUTH_API_KEY` not present locally | Optional dashboard/audit integration only. It is not a replacement for `BETTER_AUTH_SECRET`. |
| CMS public origin | `SITE_URL` not present locally | Likely required. Set `SITE_URL=https://admin.siteinabox.nl`. |
| Renderer snapshot token | `SIAB_RENDERER_API_TOKEN` not present locally | Required before production renderer snapshot access. Generate once and later reuse in the renderer stack. |
| Cloudflare SMTP | `EMAIL_FROM` present locally; `CLOUDFLARE_EMAIL_SMTP_TOKEN` not present locally | Required for production auth/preview email after the mail-path change. |
| Resend | `RESEND_API_KEY` not present locally; older production env previously had it | Obsolete after Cloudflare SMTP replacement. Remove from production env during the operator update. |
| Mollie | no `MOLLIE_*` keys present locally | Required for production payment smoke: `MOLLIE_API_KEY`, amount, currency, webhook base URL, and optional signing secret. |
| Legacy preview | `PREVIEW_HMAC_SECRET` present locally | Optional/internal compatibility only. Keep legacy token route disabled unless explicitly approved. |
| Bootstrap | no `BOOTSTRAP_TOKEN` present locally | Must remain unset except during a one-time fresh super-admin bootstrap. |

Renderer `.env` remains operator-gated. The CMS-side
`SIAB_RENDERER_API_TOKEN` and renderer-side `SIAB_RENDERER_API_TOKEN` must stay
identical for snapshot API access.

Current production migrations:

- latest recorded migration is `20260611_010713_add_better_auth_tables`;
- these newer branch tables do not exist yet in production:
  - `intake_submissions`
  - `site_generation_runs`
  - `published_site_snapshots`
  - `preview_access_grants`

Current production CMS data:

- one tenant was observed: `id=7`, `slug=ami-care`, `domain=ami-care.nl`,
  `status=active`;
- Amblast is not currently represented as a CMS tenant in the inspected
  production DB.

## External Mail Research

Cloudflare Email Service currently supports outbound transactional email through
Workers bindings, REST API, and SMTP. Cloudflare documents that Email Service
requires Cloudflare DNS for the sending domain and that Email Sending to
arbitrary recipients requires a Workers Paid plan. Cloudflare SMTP uses
`smtp.mx.cloudflare.net:465`, implicit TLS, username `api_token`, and a
Cloudflare API token with Email Sending permission.

Payload's current email docs recommend `@payloadcms/email-nodemailer` when using
SMTP or any generic Nodemailer transport. Better Auth magic links require the
application to provide a `sendMagicLink` callback, so Better Auth does not
remove the need for a mail delivery implementation in this codebase.

References:

- https://developers.cloudflare.com/email-service/
- https://developers.cloudflare.com/email-service/get-started/send-emails/
- https://developers.cloudflare.com/email-service/api/send-emails/smtp/
- https://developers.cloudflare.com/email-service/api/send-emails/rest-api/
- https://developers.cloudflare.com/email-service/platform/pricing/
- https://payloadcms.com/docs/email/overview
- https://better-auth.com/docs/plugins/magic-link
- https://better-auth.com/docs/infrastructure/services/email

Recommended mail direction for this plan:

- Use Cloudflare Email Service SMTP via Nodemailer for CMS/Payload email and the
  app-level Better Auth email callbacks.
- Replace `@payloadcms/email-resend` with `@payloadcms/email-nodemailer`.
- Use `apps/cms/src/lib/email/sendEmail.ts` as the provider-neutral mail module
  backed by Cloudflare SMTP in production and a test/mock transport in tests.
- Keep Better Auth Infrastructure email out of this phase unless explicitly
  chosen later, because it covers auth-oriented templates but does not by itself
  solve all current Payload/custom email paths.

## Target Production Stack Shape

After approved execution, the production stack should be:

```txt
/srv/saas/infra/stacks/siteinabox/
  apps/
    cms/
      compose.yml
      .env
    site/
      docker-compose.yml
    renderer/
      compose.yml
      .env
  tenants/
    ami-care/
      compose.yml       # unchanged legacy/current site
      .env
    amblast/
      compose.yml       # unchanged legacy/current site
      .env
```

Target routes for this staging pass:

| Host | Target app | Notes |
| --- | --- | --- |
| `admin.siteinabox.nl` | CMS | Existing route remains. |
| `preview.siteinabox.nl` | CMS | Add before preview magic-link smoke. |
| `siteinabox.nl` | landing | Existing route remains. |
| `www.siteinabox.nl` | landing/intake boundary | Currently 404; add only if approved for this pass. Full intake stays out of scope. |
| `ami-care.nl` | legacy `ami-care` | Keep unchanged. |
| `amblast.siteinabox.nl` | legacy `amblast` | Keep unchanged unless operator confirms another legacy host exists. |
| `amicare.optidigi.nl` | renderer | New staging renderer host. |
| `amblast.optidigi.nl` | renderer | New staging renderer host. |

## Execution Model

- Architect/overseer coordinates the whole plan and reviews each phase.
- Use one focused subagent per implementation phase when execution starts.
- Subagents should use GPT medium reasoning effort where the platform supports
  that selection.
- Phases are sequential; do not start a later phase until the architect has
  reviewed the prior phase.
- Every phase has research, implement, and review/test subphases.
- No production change happens without an explicit operator approval gate.

## Phase 0: Final Read-Only Preflight Agent

Goal: refresh the production facts immediately before any mutation.

### Research

- Re-run read-only inventory of `/srv/saas/infra/stacks/siteinabox`.
- Re-read compose files and redacted `.env` key names.
- Capture current image IDs and container health.
- Capture current Payload migration list and table existence.
- Capture current Traefik route smoke statuses for the target hosts.

### Implement

- No server writes.
- Update this document only if preflight facts differ from the current snapshot.

### Review/Test

- Confirm no secrets were printed.
- Confirm no compose, `.env`, DB, image, or route state changed.

### Approval Gate

Operator approves moving from read-only preflight into code changes.

## Phase 1: Cloudflare Mail Replacement Agent

Goal: remove Resend from production mail delivery and use one mail path for
Payload, CMS custom email, main Better Auth, and preview Better Auth.

### Research

- Inspect all current imports of the CMS mail module.
- Inspect Payload email adapter usage in `apps/cms/src/payload.config.ts`.
- Verify current Payload Nodemailer adapter package/version.
- Verify Cloudflare Email Service SMTP settings and required env.
- Confirm whether the sender domain, likely `siteinabox.nl`, is onboarded in
  Cloudflare Email Service and can send from `EMAIL_FROM`.

### Implement

- Add `@payloadcms/email-nodemailer` and remove `@payloadcms/email-resend`.
- Replace the Resend module with a provider-neutral mail module.
- Configure Payload `email` with Nodemailer transport:
  - host `smtp.mx.cloudflare.net`;
  - port `465`;
  - secure `true`;
  - user `api_token`;
  - password from a production secret.
- Wire main Better Auth and preview Better Auth magic-link callbacks to the same
  mail module.
- Keep tests deterministic by mocking the mail transport.
- Update `.env.example`, CMS compose, and deploy docs:
  - remove `RESEND_API_KEY`;
  - add Cloudflare Email Service secret names;
  - document the sender-domain onboarding requirement.

Proposed production env names:

- `EMAIL_FROM=noreply@siteinabox.nl`
- `CLOUDFLARE_EMAIL_SMTP_TOKEN=<secret>`
- optional `EMAIL_TRANSPORT=cloudflare-smtp`

### Review/Test

- `pnpm cms:typecheck`
- `pnpm cms:test`
- focused Better Auth preview magic-link tests
- focused email module tests
- verify Resend package/import/env references are removed from active production
  code/docs

### Approval Gate

Operator approves deploying a CMS image that uses Cloudflare mail.

## Phase 2: Renderer Image And Deploy Contract Agent

Goal: make `apps/renderer` deployable as a platform-owned runtime image.

Status: local implementation prepared. Added the renderer Dockerfile,
production compose template, GHCR workflow, `/healthz` endpoint, and renderer
deployment docs. No VPS, production `.env`, route, or image push changes were
made by this phase worker.

### Research

- Inspect Astro Node standalone output and runtime start command.
- Confirm required runtime env for the Astro server: `HOST`, `PORT`,
  `NODE_ENV`, `SIAB_CMS_URL`, `SIAB_RENDERER_API_TOKEN`, and `SITE_URL`.
- Decide whether to add a small `GET /healthz` route for Docker healthchecks.
  This is operational plumbing only, not a product feature.
- Confirm GHCR image naming:
  `ghcr.io/optidigi/siteinabox-renderer`.
- Confirm compose path:
  `/srv/saas/infra/stacks/siteinabox/apps/renderer/compose.yml`.

### Implement

- Add `apps/renderer/Dockerfile`.
- Add a renderer build/push workflow.
- Add a production compose template for renderer.
- Add renderer env docs.
- Configure Traefik labels for staging hosts:
  - `Host(\`amicare.optidigi.nl\`)`
  - `Host(\`amblast.optidigi.nl\`)`
- Do not add tenant-specific images, folders, or workflows.
- Do not route `ami-care.nl` or legacy Amblast traffic to renderer yet.

Proposed renderer env:

- `NODE_ENV=production`
- `SIAB_CMS_URL=https://admin.siteinabox.nl`
- `SIAB_RENDERER_API_TOKEN=<same as CMS>`
- `SITE_URL=<stable platform renderer origin>`
- `SIAB_RENDERER_FIXTURE_MODE=`

### Review/Test

- `pnpm renderer:typecheck`
- `pnpm renderer:build`
- local Docker build for `apps/renderer`
- local container smoke with fixture mode outside production
- local container smoke against a mocked CMS snapshot endpoint if practical

### Approval Gate

Operator approves pushing/pulling the renderer image and creating the renderer
stack on the VPS.

## Phase 3: CMS Production Env And Migration Agent

Goal: deploy the updated CMS safely and apply the pending Payload migrations.

Status: documentation/prep only. Final production smoke/review remains blocked
until the operator sets the production CMS `.env` values and explicitly
approves production mutation. No agent is authorized to SSH to production,
change `.env`, run migrations, pull images, or restart containers in this
phase-prep task.

### Research

- Confirm current production `.env` keys remain redacted.
- Confirm the production DB backup command and destination under `/srv/backup`
  or another operator-approved location.
- Confirm current CMS image ID/tag for rollback.
- Confirm `preview.siteinabox.nl` should be added to the CMS Traefik rule.
- Confirm whether `www.siteinabox.nl` should be added to the landing route in
  this pass or deferred with intake.

### Implement

- Operator creates a timestamped Postgres backup before changing the CMS image.
- Operator updates production CMS `.env` with real values:
  - `PAYLOAD_SECRET` existing value retained;
  - existing `POSTGRES_PASSWORD` retained;
  - `DATA_HOST_PATH=/srv/data/saas/siab-payload` retained;
  - `SUPER_ADMIN_DOMAIN=siteinabox.nl` retained;
  - current `VPS_IP` retained;
  - existing PostHog values retained;
  - `BETTER_AUTH_SECRET`;
  - `BETTER_AUTH_PREVIEW_SECRET`;
  - `SITE_URL=https://admin.siteinabox.nl`;
  - `SIAB_RENDERER_API_TOKEN`;
  - Cloudflare Email Service secrets;
  - Mollie secrets/settings;
  - `BETTER_AUTH_API_KEY` only if Better Auth Infrastructure is approved and
    configured;
  - no `RESEND_API_KEY`;
  - `BOOTSTRAP_TOKEN` remains unset.
- Update CMS compose env mapping for the new mail and renderer vars.
- Add `preview.siteinabox.nl` to the CMS Traefik rule.
- Operator pulls and deploys the reviewed CMS image after backup and env review.
- `migrate-on-boot` applies committed Payload migrations during container
  start; do not run ad hoc migration SQL against production.

### Review/Test

- `docker compose ps` shows CMS and Postgres healthy.
- `docker logs siteinabox-cms` shows migrations applied or no pending
  migrations.
- `GET https://admin.siteinabox.nl/api/health` returns healthy.
- `preview.siteinabox.nl` routes to CMS rather than Traefik 404.
- Production DB contains:
  - `intake_submissions`;
  - `site_generation_runs`;
  - `published_site_snapshots`;
  - `preview_access_grants`.
- Existing CMS login/admin still works.

### Approval Gate

Operator approves using the migrated CMS DB to create staging renderer data.

## Phase 4: Renderer Staging Tenant Data Agent

Goal: prove Amicare and Amblast through renderer-hosted staging domains without
touching the current legacy production routes.

### Research

- Inspect current renderer-compatible fixtures in
  `packages/contracts/src/fixtures/tenants.ts`.
- Inspect importer/publish services to choose the safest bootstrap path.
- Confirm whether staging data should be separate tenants:
  - preferred: `amicare-renderer` with domain `amicare.optidigi.nl`;
  - preferred: `amblast-renderer` with domain `amblast.optidigi.nl`.
- Confirm no existing production tenant or legacy route is modified.

### Implement

- Use the CMS operator helper after migrations have run:
  - dry-run first from `apps/cms`:
    `pnpm seed:renderer-staging`;
  - import draft staging tenants only:
    `pnpm seed:renderer-staging -- --execute`;
  - run one tenant only when needed:
    `pnpm seed:renderer-staging -- --tenant=amicare`;
  - after explicit operator approval and verified staging DNS/proxy routing,
    publish and activate:
    `pnpm seed:renderer-staging -- --execute --approve --verify-domain --waive-payment --promote-pages --publish --activate`.
- The helper clones the renderer-compatible structured specs for Amicare and
  Amblast, validates them with `SiteGenerationSpecSchema`, and applies them via
  `applySiteGenerationSpec`. It does not create tenant source folders, tenant
  images, GitHub workflows, or arbitrary generated source code.
- Adjust staging tenant primary domains and site URLs to:
  - `amicare.optidigi.nl`;
  - `amblast.optidigi.nl`.
- Keep staging tenants separate from live tenants:
  - `amicare-renderer` with domain `amicare.optidigi.nl`;
  - `amblast-renderer` with domain `amblast.optidigi.nl`.
- Do not create or edit tenant source folders under `sites/*`.
- Promote/publish the necessary run-linked pages for snapshot eligibility.
- Mark staging domain verification as `verified` only after Traefik hosts route
  to renderer. The helper only writes that verified status when
  `--verify-domain` is passed with `--execute`.
- Use Mollie test checkout for at least one flow if keys are available; use a
  documented manual waiver only when explicitly approved. The helper only
  records a manual waiver when `--waive-payment` is passed with `--execute`.
- Publish and activate staging snapshots. Each `--publish` run may create a new
  immutable snapshot; `--activate` requires `--publish` and uses the existing
  CMS activation path with `manualActivation: true` and an activation reason.

### Review/Test

- Confirm both staging tenants exist in CMS.
- Confirm both have active published snapshots.
- Confirm both snapshot payloads validate against contracts.
- Confirm draft CMS edits after activation do not alter renderer output.
- Confirm rollback changes the active snapshot back.

### Approval Gate

Operator approves starting the renderer stack smoke against staging domains.

## Phase 5: Renderer Stack Deployment Agent

Goal: deploy `apps/renderer` and route only the staging hosts to it.

### Research

- Confirm renderer image tag to deploy.
- Confirm renderer compose service joins external `proxy`.
- Confirm Traefik preserves `Host` by default and observe
  `X-Forwarded-Host` behavior through smoke requests.

### Implement

- Create `/srv/saas/infra/stacks/siteinabox/apps/renderer/compose.yml`.
- Create `/srv/saas/infra/stacks/siteinabox/apps/renderer/.env` with redacted
  operator-provided secrets.
- `docker compose pull`.
- `docker compose up -d`.
- Keep legacy `ami-care` and `amblast` stacks running.

### Review/Test

- `docker compose ps` shows renderer healthy.
- `curl --resolve amicare.optidigi.nl:443:127.0.0.1 https://amicare.optidigi.nl/`
  returns renderer output.
- `curl --resolve amblast.optidigi.nl:443:127.0.0.1 https://amblast.optidigi.nl/`
  returns renderer output.
- Root pages render.
- At least one subpage per tenant renders.
- Unknown path returns 404.
- Unknown host returns 404.
- Missing/incorrect renderer bearer token returns failure at CMS snapshot API.
- Legacy routes still return their old containers:
  - `ami-care.nl`;
  - `amblast.siteinabox.nl`.

### Approval Gate

Operator approves full staging smoke.

## Phase 6: End-To-End Staging Smoke Agent

Goal: prove the production chain with real routing, real mail delivery, Mollie
test-mode payment, snapshots, activation, rollback, and renderer lookup.

### Research

- Identify the generation run and preview grant IDs used for staging smoke.
- Confirm a test recipient mailbox for preview magic-link delivery.
- Confirm Mollie test key and webhook base URL.

### Implement

- No product features.
- Create only the data needed for the smoke path.

### Review/Test

Smoke checklist:

1. Request preview magic link for a staging tenant.
2. Confirm Cloudflare-delivered email arrives.
3. Open preview URL at `https://preview.siteinabox.nl/{clientSlug}`.
4. Confirm Better Auth session is required and then established.
5. Confirm preview renders through `packages/site-renderer` and no iframe.
6. Change allowed style tokens and save.
7. Reload preview and confirm persistence.
8. Approve preview.
9. Create Mollie checkout.
10. Complete Mollie test payment.
11. Confirm webhook updates payment state only.
12. Confirm publish without satisfied gates blocks where expected.
13. Publish and activate with gates satisfied.
14. Confirm renderer serves active snapshot.
15. Confirm a CMS draft change does not affect renderer output.
16. Republish and activate a new snapshot.
17. Confirm renderer output changes.
18. Roll back.
19. Confirm renderer output reverts.
20. Confirm suspended/archived tenant does not serve public renderer output.
21. Confirm unknown host and unknown path return 404.
22. Confirm unauthenticated publish fails.
23. Confirm non-super-admin publish fails.

### Approval Gate

Operator approves whether to leave staging renderer hosts up for observation or
roll them back.

## Phase 7: Later Final Tenant Cutover

Goal: only after staging parity is accepted, migrate live tenant traffic from
legacy containers to renderer.

This phase is not part of the immediate deployment pass.

Future steps:

- Create production-domain CMS tenant/snapshot data for the real live domains.
- Compare renderer output against legacy Amicare/Amblast.
- Switch Traefik host rules for live domains to renderer.
- Keep legacy containers available as rollback for a defined window.
- Remove or archive legacy routes only after operator sign-off.

## Rollback Strategy

- Do not remove current legacy containers.
- Do not route current live tenant domains to renderer in this pass.
- Before CMS migration, create a DB backup and record current CMS image ID.
- If CMS deploy fails before migration completes, roll back image/compose and
  restore the prior env.
- If migration succeeds but app behavior fails, prefer code rollback against the
  migrated schema; DB restore is the last resort because Payload migrations are
  forward-oriented.
- If renderer deploy fails, stop/remove only the renderer stack and leave legacy
  routes untouched.
- If staging tenant data is bad, deactivate/delete staging snapshots only after
  export/inspection; do not touch legacy tenant stacks.

## Production Secrets Checklist

Do not commit these values.

CMS:

- `POSTGRES_PASSWORD`
- `PAYLOAD_SECRET`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_PREVIEW_SECRET`
- `SITE_URL=https://admin.siteinabox.nl`
- `SIAB_RENDERER_API_TOKEN`
- `EMAIL_FROM`
- `CLOUDFLARE_EMAIL_SMTP_TOKEN`
- `MOLLIE_API_KEY`
- `MOLLIE_SITE_PAYMENT_AMOUNT`
- `MOLLIE_SITE_PAYMENT_CURRENCY`
- `MOLLIE_WEBHOOK_BASE_URL=https://admin.siteinabox.nl`
- optional `MOLLIE_WEBHOOK_SIGNING_SECRET`
- existing PostHog values as needed
- optional social auth provider secrets

Renderer:

- `SIAB_CMS_URL=https://admin.siteinabox.nl`
- `SIAB_RENDERER_API_TOKEN`
- `SITE_URL`
- `NODE_ENV=production`

Must remain unset in normal production:

- `BOOTSTRAP_TOKEN`
- `SIAB_RENDERER_FIXTURE_MODE`
- `ENABLE_GRAPHQL_PLAYGROUND`
- `ENABLE_LEGACY_PREVIEW_TOKEN_ROUTE`, unless temporary internal compatibility
  is explicitly approved.

## Definition Of Done For This Pass

- Resend is no longer used by production CMS mail paths.
- Cloudflare Email Service sends preview magic-link email successfully.
- Production CMS migrations are applied and tables exist.
- `preview.siteinabox.nl` is routed and Better Auth gated.
- Renderer has a platform image, compose stack, and healthy container.
- `amicare.optidigi.nl` and `amblast.optidigi.nl` render through generic
  `apps/renderer`.
- Existing legacy routes still work.
- Published snapshots are created, activated, retrieved, and rolled back.
- Renderer serves only active snapshots.
- Draft CMS data is not public until republished.
- Mollie test checkout and webhook update payment state without auto-publishing.
- Unknown host/path and inactive tenant cases return blocked/404 behavior.
