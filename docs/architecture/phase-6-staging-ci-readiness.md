# Phase 6 Staging and CI Readiness

Date: 2026-06-26

This runbook records the current end-to-end staging surface for the SIAB
monorepo. It is scoped to verification, deployment assumptions, and small
readiness checks. It does not approve new product features, domain automation,
tenant-specific generated source, tenant-specific workflows, or tenant-specific
images.

## Route Matrix

| Surface | Route | Owner | Verification mode | Notes |
| --- | --- | --- | --- | --- |
| Marketing | `/` and static marketing pages | `apps/landing` | Local build/test | Public Site in a Box marketing site. |
| Intake | `/intake` | `apps/intake` | Local build/test plus staging route check | Public scaffold/operator intake app. Submit URL is `PUBLIC_INTAKE_API_URL`, default `/api/intake`. |
| Intake API | `POST /api/intake` | `apps/cms` | CMS unit tests plus staging POST smoke | Accepts public structured intake only. Rejects test fixture controls and unknown fields. |
| CMS admin | `/admin`, custom frontend admin routes | `apps/cms` | CMS typecheck/test/UI lint plus staging login smoke | Payload remains the content and tenant authority. |
| Preview auth | `/api/preview-auth/[...all]` | `apps/cms` | CMS unit tests plus staging magic-link flow | Better Auth preview instance for `preview.siteinabox.nl`. |
| Preview | `https://preview.siteinabox.nl/{clientSlug}` | `apps/cms` | CMS unit tests plus staging browser smoke | Magic-link/session gated. Renders shared renderer directly; no iframe. |
| Legacy preview | `/preview/[token]`, `/api/preview-tokens` | `apps/cms` plus legacy snapshots | Unit tests plus production env check | HMAC preview route is fail-closed in production unless `ENABLE_LEGACY_PREVIEW_TOKEN_ROUTE=1`. |
| Payments | `/api/payments/mollie/webhook` | `apps/cms` | CMS unit tests plus Mollie test webhook in staging | Webhooks update generation-run payment state only. They do not publish, activate, or automate DNS. |
| Publish | `POST /api/publish` | `apps/cms` | CMS unit tests plus staging operator smoke | Publishes immutable snapshots and optionally activates when gates pass. |
| Renderer snapshot API | `GET /api/renderer/snapshot?host=<host>` | `apps/cms` | CMS unit tests plus staging bearer-token smoke | Returns only active tenant active snapshots. Requires `SIAB_RENDERER_API_TOKEN` in production. |
| Live renderer | `/{path}` by tenant host | `apps/renderer` | Renderer typecheck/build plus staging host smoke | Resolves request host through CMS snapshot API. No draft CMS reads, no fixture fallback in production. |
| Removed tenant app sources | N/A | N/A | Renderer deploy contract | Tenant-specific app source folders, images, and build commands must not be restored. |

## Operation Matrix

| Operation | Local deterministic coverage | Staging-only/manual checks | Invariants |
| --- | --- | --- | --- |
| Public intake validation | `publicIntakeValidation.test.ts`, `intakeGenerationRun.test.ts`, `apps/intake/tests/intake-schema.test.ts` | Same-origin `/intake` POST reaches CMS; user-safe error display | Intake sends structured data only; no generated source files. |
| Generation | `applySiteGenerationSpec.test.ts`, `intakeGenerationRun.test.ts`, catalog governance tests | OpenAI provider only if explicitly enabled with staging secrets | AI output must validate as `SiteGenerationSpec`; malformed output writes no tenant/page/settings records. |
| Preview access | `preview-access.test.ts`, `preview-access-action.test.ts`, `request-preview-magic-link.test.ts`, `preview-route.test.tsx` | Magic-link email delivery and session cookie behavior on `preview.siteinabox.nl` | Preview is Better Auth/session gated and grant scoped. |
| Preview customizer/approval | `preview-customizer.test.ts`, `preview-customizer-source.test.ts` | Customer preview acceptance browser smoke | Preview renders the shared renderer directly; no iframe boundary. |
| Payment checkout/webhook | `molliePayments.test.ts`, `generationRunPayment.test.ts`, `generationRunPaymentAction.test.ts` | Mollie test checkout and webhook delivery from Mollie dashboard/tunnel | PSP is Mollie. Payment state alone never publishes or activates a site. |
| Manual domain verification | `domainVerificationAction.test.ts` | DNS and Traefik host-rule checks | OpenProvider/Cloudflare automation is deferred. |
| Publish/activate/rollback | `publish-current-state.test.ts`, `publish-route.test.ts`, `publishOperations.test.ts` | Operator smoke for publish, activate, rollback in staging | Live activation requires approved preview plus completed/waived payment, unless explicit super-admin manual activation is used; tenant/domain gates still apply. |
| Renderer snapshot lookup | `renderer-snapshot-route.test.ts`, `renderer-snapshot-loader.test.ts` | Bearer token parity, `Host`/`X-Forwarded-Host` preservation, unknown host 404 | Live renderer serves only active published snapshots and inactive/unknown hosts return 404. |
| Landing/intake/legacy builds | Package build/test commands | Public route and asset smoke after deploy | Compatibility `site:*` scripts map to landing. |

## Environment Variable Inventory

CMS/staging:

- `DATABASE_URI`: Payload/Postgres and Better Auth database connection.
- `PAYLOAD_SECRET`: Payload secret; also fallback for Better Auth secrets.
- `BETTER_AUTH_SECRET`: main Better Auth secret.
- `BETTER_AUTH_PREVIEW_SECRET`: preview Better Auth secret; falls back to `BETTER_AUTH_SECRET`/`PAYLOAD_SECRET`.
- `BETTER_AUTH_ALLOWED_HOSTS`: only for additional CMS auth hosts; tenant admin hosts are resolved dynamically.
- `BETTER_AUTH_API_KEY`, `BETTER_AUTH_API_URL`, `BETTER_AUTH_KV_URL`: optional Better Auth Infrastructure bridge.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID`, `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`: optional social providers.
- `NEXT_PUBLIC_SUPER_ADMIN_DOMAIN`: super-admin host domain, expected `siteinabox.nl`.
- `SITE_URL`: public CMS/admin origin.
- `DATA_DIR`: CMS tenant media/projection data directory.
- `CLOUDFLARE_EMAIL_SMTP_TOKEN`, `EMAIL_FROM`: email delivery for auth/preview messaging.
- `MOLLIE_API_KEY`, `MOLLIE_SITE_PAYMENT_AMOUNT`, `MOLLIE_SITE_PAYMENT_CURRENCY`, `MOLLIE_WEBHOOK_BASE_URL`, `MOLLIE_WEBHOOK_SIGNING_SECRET`: Mollie checkout/webhook configuration.
- `POSTHOG_ANALYTICS_DISABLED`, `POSTHOG_HOST`, `POSTHOG_PUBLIC_HOST`, `POSTHOG_PROJECT_TOKEN`, `POSTHOG_PROJECT_ID`, `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_ENVIRONMENT`: analytics configuration.
- `NEXT_PUBLIC_VPS_IP`: operator DNS guidance display.
- `BOOTSTRAP_TOKEN`: one-time super-admin seed token; must be unset after bootstrap.
- `PREVIEW_HMAC_SECRET`, `ENABLE_LEGACY_PREVIEW_TOKEN_ROUTE`: legacy HMAC preview compatibility only.
- `SIAB_RENDERER_API_TOKEN`: shared bearer token checked by CMS and sent by renderer.
- `SIAB_SITE_BUILD_ID`: optional build id recorded in snapshot analytics context.
- `SITE_GENERATION_PROVIDER`, `SITE_GENERATION_OPENAI_MODEL`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`: generation provider configuration; default remains mocked generation.

Renderer/staging:

- `SIAB_CMS_URL`: CMS origin used for `/api/renderer/snapshot`.
- `SIAB_RENDERER_API_TOKEN`: same token as CMS.
- `SITE_URL`: renderer canonical origin for Astro config.
- `SIAB_RENDERER_FIXTURE_MODE`: local development only; ignored in production.

Landing/intake/legacy snapshots:

- `PUBLIC_INTAKE_API_URL`: intake submit endpoint; production should route `/api/intake` to CMS.
- `PUBLIC_ADMIN_ORIGIN`, `PREVIEW_HMAC_SECRET`: legacy preview compatibility for static surfaces.
- `PUBLIC_WEB3FORMS_KEY`, `PUBLIC_CONTACT_EMAIL`: legacy/static contact form config where present.
- `CMS_DATA_DIR`, `CMS_DATA_DIR_ABS`, `CMS_TENANT_ID`: legacy tenant snapshot local projection helpers.

## Migration Inventory

Current production-readiness migrations added by recent phases:

- `20260611_010713_add_better_auth_tables.ts`: Better Auth persistence.
- `20260625_163925_add_intake_generation_runs.ts`: intake submissions and generation runs.
- `20260625_190000_add_ai_generation_run_metadata.ts`: provider/model/prompt/hash metadata.
- `20260625_210000_add_preview_approval_state.ts`: preview approval/payment handoff fields.
- `20260625_230000_add_published_site_snapshots.ts`: immutable published snapshots.
- `20260626_120000_add_preview_access_grants.ts`: preview access grants.

The complete migration list is in `apps/cms/src/migrations/index.ts` and must
match committed migration files before staging deploy. Run Payload migrations
against staging before any browser flow that depends on intake, preview grants,
payment state, or published snapshots.

## Deployment Assumptions

- Platform app images remain `ghcr.io/optidigi/siteinabox-cms` and
  `ghcr.io/optidigi/siteinabox-site` unless an approved deploy contract adds
  a renderer image.
- Tenant-specific app images have been removed; generated sites are served by `ghcr.io/optidigi/siteinabox-renderer`.
- Traefik is the production edge proxy on the shared external `proxy` network.
- `/intake` is served by the intake app or routed from the public marketing
  host; `/api/intake` must reach CMS.
- `preview.siteinabox.nl` routes to CMS and preserves the public host.
- Tenant primary domains and aliases route to the renderer and preserve
  `Host` and preferably `X-Forwarded-Host`.
- Domain purchase and DNS/proxy automation are manual/deferred. Do not add
  OpenProvider or Cloudflare automation in this phase.
- Mollie is the only PSP in scope. Do not introduce Stripe wiring.

## Mocked, Manual, and Deferred

- Mocked locally: default site generation provider, provider-neutral payment
  completed/waived states, renderer fixture mode outside production.
- Manual in staging: email deliverability, Mollie hosted checkout/webhook,
  DNS/Traefik routing, domain verification, bootstrap token removal, rollback
  operator smoke.
- Deferred: full intake product implementation, KVK enrichment, OpenProvider
  domain purchase, Cloudflare DNS/proxy automation, canonical renderer redirects,
  per-tenant generated source/deploy artifacts.

## Verification Matrix

Run from the monorepo root unless noted:

```bash
pnpm packages:typecheck
pnpm cms:typecheck
pnpm cms:test
pnpm renderer:typecheck
pnpm renderer:build
pnpm landing:build
pnpm landing:test
pnpm intake:build
pnpm intake:test
pnpm site:build
pnpm renderer:build
pnpm --dir apps/cms --ignore-workspace lint:ui-boundary
pnpm --dir apps/cms --ignore-workspace lint:ui-composition
pnpm --dir apps/cms --ignore-workspace lint:no-css
git diff --check
```

Focused deterministic checks for the end-to-end staging surface:

```bash
pnpm --dir apps/cms --ignore-workspace test tests/unit/intakeGenerationRun.test.ts
pnpm --dir apps/cms --ignore-workspace test tests/unit/publicIntakeValidation.test.ts
pnpm --dir apps/cms --ignore-workspace test tests/unit/preview-access.test.ts tests/unit/preview-route.test.tsx tests/unit/request-preview-magic-link.test.ts
pnpm --dir apps/cms --ignore-workspace test tests/unit/molliePayments.test.ts tests/unit/generationRunPayment.test.ts tests/unit/generationRunPaymentAction.test.ts
pnpm --dir apps/cms --ignore-workspace test tests/unit/publish-current-state.test.ts tests/unit/publish-route.test.ts tests/unit/publishOperations.test.ts
pnpm --dir apps/cms --ignore-workspace test tests/unit/renderer-snapshot-route.test.ts tests/unit/renderer-snapshot-loader.test.ts
```

Staging smoke checks after deploy:

1. `GET https://admin.siteinabox.nl/api/health` returns healthy.
2. `GET https://www.siteinabox.nl/intake` renders the intake surface.
3. Submit a non-production test intake payload through `/api/intake`; confirm one
   intake submission and one generation run.
4. Create or confirm a preview access grant; request a magic link at
   `https://preview.siteinabox.nl/{clientSlug}` and confirm session-gated access.
5. Approve preview, create a Mollie test checkout, complete the payment, and
   confirm only generation-run payment JSON changes.
6. Manually verify domain routing in CMS after DNS/Traefik checks.
7. Publish and activate a snapshot; confirm renderer serves the active snapshot
   by primary host and alias.
8. Change a CMS draft page after activation; confirm live renderer output does
   not change until another publish/activation.
9. Confirm unknown host, inactive tenant, and unknown page path return 404.
10. Roll back to the prior snapshot and confirm renderer output follows the
    reactivated snapshot.
