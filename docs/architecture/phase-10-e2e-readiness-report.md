# Phase 10 E2E Readiness Report

Date: 2026-06-26

## Local Service Prerequisites

Full browser E2E for the customer/operator/live-site flow requires:

- Node 26, matching the CMS `engines` field.
- Postgres with the Payload schema and test/dev credentials.
- CMS dev server on the Playwright-configured URL, normally `http://localhost:3001`.
- Renderer dev server with `SIAB_CMS_URL`, `SIAB_RENDERER_API_TOKEN`, and host forwarding configured.
- Public site build/dev server for `/intake` if the browser test starts from the marketing intake form.
- Payment provider env only when testing a real provider. Current activation coverage uses the provider-neutral completed/waived states.

Observed local state:

- `node -v`: `v24.13.1`, below the CMS requirement `>=26 <27`. Commands run with engine warnings, while CI uses Node 26.
- `pnpm -v`: `11.5.0`.
- Docker is not installed. Podman is installed.
- Postgres is available through Podman container `siteinabox-cms-postgres-dev` and `pg_isready` reports accepting connections.
- `apps/cms/.env` exists. `apps/renderer/.env` does not exist.
- Browser E2E was not added or run in this phase because there is no existing stable full-flow harness and the renderer/CMS/public-site multi-server env is not preconfigured here. Adding that harness would be broad and fragile for CI at this point.

## Automated Coverage Inventory

Existing and Phase 10 coverage proves the core flow at service/integration level:

- Public intake validation rejects public fixture controls and unknown fields: `apps/cms/tests/unit/publicIntakeValidation.test.ts`.
- Intake processing creates intake records, generation runs, validated draft CMS records, idempotency, provider failure states, unsupported block rejection, and malformed output rejection: `apps/cms/tests/unit/intakeGenerationRun.test.ts`.
- Site generation import creates draft tenant/page/settings/theme/manifest data and keeps invalid specs from writing: `apps/cms/tests/unit/applySiteGenerationSpec.test.ts`.
- Preview token and customizer service covers tenant/page isolation, theme persistence, approval, and pending payment handoff: `apps/cms/tests/unit/preview-customizer.test.ts`, `apps/cms/tests/unit/preview-token-route.test.ts`, `apps/cms/tests/unit/preview-sign.test.ts`.
- Page promotion covers approved run-linked pages and rejects stale/missing/no linked pages: `apps/cms/tests/unit/promoteGenerationRunPages.test.ts`.
- Payment state normalization and activation-satisfying states are provider neutral: `apps/cms/tests/unit/generationRunPayment.test.ts`, `apps/cms/tests/unit/generationRunPaymentAction.test.ts`.
- Publish/activate/rollback, activation gates, immutable snapshots, draft/live isolation, inactive tenant behavior, and alias host resolution are covered: `apps/cms/tests/unit/publishedSiteSnapshots.test.ts`, `apps/cms/tests/unit/publish-route.test.ts`, `apps/cms/tests/unit/publishOperations.test.ts`.
- Manual domain verification action covers super-admin access and audit fields: `apps/cms/tests/unit/domainVerificationAction.test.ts`.
- CMS renderer snapshot endpoint covers bearer auth, unknown host, alias host, inactive tenant, invalid stored snapshot, and forwarded host: `apps/cms/tests/unit/renderer-snapshot-route.test.ts`.
- Renderer loader covers production fixture gating, bearer token forwarding, root/subpage/unknown path resolution, and defensive draft-like page exclusion: `apps/cms/tests/unit/renderer-snapshot-loader.test.ts`.

## Phase 10 Changes

- Added renderer page-resolution coverage for root, subpage, unknown path, path listing, and defensive draft-like page exclusion in `apps/cms/tests/unit/renderer-snapshot-loader.test.ts`.
- Fixed the existing noopener audit blocker in `apps/cms/src/components/generation/PreviewLinkShare.tsx` by changing preview links to `rel="noopener noreferrer"`.

## Command Matrix

All commands below were run locally on Node `v24.13.1`. CMS commands emitted the expected engine warning for Node 26 parity.

- `pnpm packages:typecheck`: passed.
- `pnpm cms:typecheck`: passed with Node engine warning.
- `pnpm cms:test`: passed after the noopener fix. Final result: `151 passed`, `1154 passed`.
- `pnpm renderer:typecheck`: passed.
- `pnpm renderer:build`: passed. Vite warned that `"use client"` directives in `lucide-react` were ignored during bundling.
- `pnpm site:build`: passed. Vite warned that `/theme/images/icon/icon_33.svg` remains runtime-resolved.
- `pnpm tenant:amicare:build`: passed.
- `pnpm tenant:amblast:build`: passed. Vite warned that legacy font paths remain runtime-resolved.

Focused checks:

- `pnpm --dir apps/cms --ignore-workspace test tests/unit/renderer-snapshot-loader.test.ts`: passed, `5 passed`.
- `pnpm --dir apps/cms --ignore-workspace test tests/unit/audit-p3-14-noopener.test.ts`: passed, `3 passed`.

## Readiness Notes

The full customer/operator/live-site flow is covered by stable unit/integration tests across service boundaries, including invalid generation output, draft import, preview approval, promotion, payment gating, publish, activation, renderer snapshot lookup, renderer page resolution, draft/live isolation, inactive tenants, unknown hosts, unknown paths, republish, and rollback.

What is not yet proven by automation is a single browser-driven staging journey across public intake, CMS operator UI, customer preview/customizer UI, and renderer live pages. That should be added only after a committed multi-server E2E harness exists with Node 26, Postgres, CMS, renderer, public site, seeded auth, deterministic host routing, and provider-neutral payment fixtures.
