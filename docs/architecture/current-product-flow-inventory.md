# Current Product Flow Inventory

Phase 1 inventory for the product-completion plan. This document records the
current implementation only; it does not define new product behavior.

## Source Scope

- Public marketing app: `apps/landing`.
- Public intake app: `apps/intake`.
- CMS/control plane: `apps/cms`.
- Generic renderer: `apps/renderer`.
- Shared contracts and rendering: `packages/contracts` and
  `packages/site-renderer`.

See `docs/architecture/route-surface-inventory.md` for the full source-defined
route inventory and production host contract.

## Perspective Map

| Perspective | Current user-operable surfaces | Current non-UI operations |
| --- | --- | --- |
| Public customer | `apps/landing/src/pages/index.astro` and `apps/landing/src/pages/contact.astro`; contact posts to CMS `POST /api/contact` for platform mail. `apps/intake/src/pages/index.astro` owns the public intake scaffold and posts structured submissions to the configured CMS intake API. Customer preview lives under `apps/cms/src/app/(frontend)/(site-preview)/[clientSlug]` and renders site output through the `/renderer-frame` route. The signed preview-token route is internal compatibility only. | Intake depends on CMS `POST /api/intake`, which stores submissions and starts validated draft generation. Optional KVK enrichment is proxied through CMS-owned `/api/intake/kvk/*` endpoints when configured. |
| Operator | CMS dashboard, site list/detail/edit, page editor, forms, media, users, settings, analytics, and generation-run operations under `apps/cms/src/app/(frontend)/(admin)`. Payload admin at `apps/cms/src/app/(payload)/admin/[[...segments]]/page.tsx`. | `POST /api/intake`, `POST /api/preview-tokens`, `POST /api/publish`, and direct Payload collection access for operational collections. |
| CMS admin | Payload collections for tenants, pages, forms, intake submissions, generation runs, and published snapshots. | Generation/import, approval persistence, publish, activation, renderer snapshot lookup, and rollback are implemented in services/routes. |
| Renderer | `apps/renderer/src/pages/[...path].astro` serves public paths from active snapshots. | `apps/renderer/src/lib/snapshot.ts` fetches CMS snapshots from `GET /api/renderer/snapshot`; fixture mode exists outside production. |

## End-to-End Flow

1. Intake API receives a request at
   `apps/cms/src/app/(payload)/api/intake/route.ts`.
   The route accepts JSON up to 64 KB, rejects invalid JSON/body shape, parses
   with `parsePublicIntakeSubmission`, and calls
   `storeIntakeSubmission`.
2. `apps/cms/src/lib/intake/storeIntakeSubmission.ts` normalizes the intake,
   creates or reuses an `intake-submissions` row by idempotency key, and sends
   an internal notification to `admin@siteinabox.nl`.
3. The intake route then calls `processStoredIntakeSubmission`, which creates
   the `site-generation-runs` row, calls the configured generation provider,
   validates the returned `SiteGenerationSpec`, and imports it through
   `applySiteGenerationSpec`. The reviewed-intake action remains a recovery
   path for stored submissions that do not already have a generation run.
4. `apps/cms/src/lib/site-generation/applySiteGenerationSpec.ts` upserts the
   tenant, site settings, pages, theme, and site manifest from structured data.
   Generated pages are imported with `status: "draft"` and use
   `skipProjection`, so they are not live output.
5. Customer preview access is issued from the super-admin generation-run detail
   UI. The CMS creates or refreshes a `preview-access-grants` row, then sends a
   Better Auth magic link through the isolated `/api/preview-auth/*` auth
   surface.
6. The customer preview route at `preview.siteinabox.nl/{clientSlug}` and
   `preview.siteinabox.nl/{clientSlug}/pages/{pageSlug}` requires a valid
   preview Better Auth session plus a matching active grant before loading data
   through `apps/cms/src/lib/preview/customizer.ts`. The visible preview shell
   hosts renderer output through the `/renderer-frame` route, keeping customer
   preview on the same renderer contract as live output. The old
   `/preview/[token]` route is internal compatibility only and is disabled in
   production unless `ENABLE_LEGACY_PREVIEW_TOKEN_ROUTE=1`.
7. Preview theme changes call `setPreviewTheme` and persist tenant theme JSON.
   The approval button calls `approvePreviewSite`, which records
   `clientApproval: { status: "approved" }` and payment
   `{ status: "pending_provider" }` on the latest `preview_ready` generation
   run. It does not publish or activate.
8. Generation-run snapshot publishing is available from the super-admin
   generation-run detail UI and through
   `apps/cms/src/app/(payload)/api/publish/route.ts`.
   `publishSiteSnapshot` builds an immutable `PublishedSiteSnapshot` from
   run-linked CMS pages that are already `published`, creates a
   `published-site-snapshots` row with `status: "drafted"`, and optionally
   activates it. The same API route also supports the official-tenant
   current-state publish path used by the CMS page editor: an owner/editor may
   publish and activate all currently published CMS pages for their own official
   tenant only. Tenant users cannot publish generation-run snapshots, rollback,
   operate on another tenant, or use the current-state path for non-official
   tenants.
9. Activation is handled by
   `activatePublishedSnapshot` in
   `apps/cms/src/lib/publish/siteSnapshots.ts`. Activation gates require:
   tenant not `suspended` or `archived`; domain verification `verified`;
   verified tenant Email Sending state for run-linked generated-site
   activation; approved generation run unless manual activation is requested;
   and payment `completed` or `waived` unless manual activation is requested.
   Manual activation bypasses approval/payment only. Activation marks the
   selected snapshot `active`, supersedes other active snapshots, updates the
   tenant to `status: "active"` with `activeSnapshot`, and sends a non-blocking
   `site.live_notice` handoff email for first activation of run-linked
   generated-site snapshots.
10. Renderer lookup starts in `apps/renderer/src/pages/[...path].astro`, which
   normalizes the host and calls `resolvePublishedPage`. The renderer fetches
   `GET /api/renderer/snapshot?host=...` from the CMS when `SIAB_CMS_URL` is
   set, validates the snapshot contract, finds a non-draft page by slug, and
   renders it through `SitePageRenderer`.
11. Generated-site form posts go to the renderer-owned `POST /api/forms`
    endpoint. The renderer resolves the active snapshot by Host, injects the
    snapshot tenant id, normalizes browser form/JSON payloads, and forwards to
    CMS Forms. CMS stores the submission and notifies the tenant contact email
    only when the tenant has verified Cloudflare Email Sending.
12. The CMS renderer endpoint
    `apps/cms/src/app/(payload)/api/renderer/snapshot/route.ts` authorizes with
    `SIAB_RENDERER_API_TOKEN` in production and resolves host to tenant by
    tenant domain or site-settings aliases. It returns only active tenants with
    an active, contract-valid snapshot whose snapshot domain still matches the
    tenant domain.
13. Rollback is available from the super-admin generation-run detail UI and
    through `POST /api/publish` with `action: "rollback"` and `snapshotId`. It
    activates the requested snapshot with `rollback: true`, marks prior active
    snapshots `rolled_back`, and stores the rollback reason.

## UI Inventory

### `apps/landing`

- `/`: marketing home page in `apps/landing/src/pages/index.astro`.
  Primary generation CTAs navigate to `/intake`.
- `/contact`: contact page in `apps/landing/src/pages/contact.astro`.
  The form posts to CMS `POST /api/contact`, which sends platform mail to
  `admin@siteinabox.nl`; it is intentionally separate from generation intake.
- `/__preview`: static site preview page in
  `apps/landing/src/pages/__preview.astro`.
- `/404`: public 404 page.

### `apps/intake`

- `/intake`: public intake scaffold mounted from
  `apps/intake/src/pages/index.astro`. It serializes the richer intake wizard
  state and posts contract-shaped JSON to `PUBLIC_INTAKE_SUBMIT_ENDPOINT`,
  defaulting to `/api/intake`.

### `apps/cms`

- Auth: `/login`, `/forgot-password`, `/reset-password/[token]`.
- Tenant-mode admin: dashboard `/`, pages `/pages`, forms `/forms`, media
  `/media`, navigation `/navigation`, settings `/settings`, users `/users`,
  profile `/profile`, API key `/api-key`, analytics `/analytics`.
- Super-admin site management: `/sites`, `/sites/new`, `/sites/[slug]` and
  child pages for edit, pages, forms, media, navigation, settings, users,
  onboarding, and analytics.
- Page editor/canvas: `/pages/new`, `/pages/edit/[pageSlug]`,
  `/sites/[slug]/pages/new`, `/sites/[slug]/pages/edit/[pageSlug]`.
  Numeric `/pages/[id]` and `/sites/[slug]/pages/[id]` remain compatibility
  routes for old links.
- Generation operations: `/generation-runs`,
  `/generation-runs/[id]`, and `/generation-runs/submissions/[id]`.
- Customer preview/customizer: `https://preview.siteinabox.nl/{clientSlug}` and
  `https://preview.siteinabox.nl/{clientSlug}/pages/{pageSlug}`.
- Legacy/internal signed preview: `/preview/[token]`, disabled in production
  unless explicitly enabled.
- Payload admin: `/admin`.

No automated domain checker or renderer health UI was found. The underlying
collections and routes can also be used by an operator through Payload admin or
API calls.

## Operation Visibility

| Operation | Current visibility |
| --- | --- |
| Public contact inquiry | Fully user-operable in `apps/landing`; posts to CMS `POST /api/contact` and sends platform mail via Cloudflare through `sendEmail`. |
| Generation intake submission | Public scaffold at `apps/intake` mounted on `/intake`; posts to `POST /api/intake` by configured URL. |
| Intake storage/review | Public route stores normalized submissions and starts a draft generation run through `processStoredIntakeSubmission`. Generic self-serve generation is active only for the approved exact-source Tailwind Plus Marketing provider blocks backed by the executable source-block registry: hero, feature sections, CTA, contact, testimonial, stats, and logo-cloud. The reviewed-intake super-admin controls remain a recovery path for failed or imported submissions that do not already have a generation run. |
| Generated draft review in CMS | User-operable through `/generation-runs`, `/generation-runs/[id]`, normal page list/editor, Better Auth preview access issuance, and explicit page promotion. |
| Preview access issuance | Super-admin UI on `/generation-runs/[id]` creates or refreshes a preview grant and sends a Better Auth magic link for `preview.siteinabox.nl/{clientSlug}`. |
| Preview/customizer | User-operable with a valid preview Better Auth session and active grant; includes page navigation, style save status, approval state, and payment gate status. |
| Preview theme persistence | User-operable from the Better Auth gated preview. |
| Preview approval | User-operable from the Better Auth gated preview; records approval and pending operator payment gate state only. |
| Payment completion/waiver | Mollie checkout/webhook and operator UI on `/generation-runs/[id]` update provider-neutral payment state. Payment never publishes or activates by itself. |
| Page publish/unpublish | User-operable in the page editor through page `status`; also available through Payload collection writes. |
| Snapshot publish | Operator UI on `/generation-runs/[id]` and API at `POST /api/publish`. |
| Snapshot activation | Operator UI on `/generation-runs/[id]` and API/service through `POST /api/publish` or `activatePublishedSnapshot`. |
| Live handoff email | Sent non-blockingly as `site.live_notice` after first generated-site snapshot activation. |
| Rollback | Operator UI on `/generation-runs/[id]` and API through `POST /api/publish` with `action: "rollback"`. |
| Domain and tenant sender verification | Checkout provisioning can create Cloudflare/OpenProvider domain state and Cloudflare Email Sending subdomain state; operator/manual verification remains a fallback. Activation requires verified domain ownership and, for generated-site runs, verified tenant Email Sending. |
| Mail logs and operational alerts | Payload collections `mail-logs` and `operational-alerts` are super-admin-only, metadata-only visibility for outbound delivery and important/repeated mail failures. |
| Renderer live lookup | Service-only between renderer and CMS; public users see rendered pages or 404. |
| Generated-site form submissions | Renderer `POST /api/forms` proxies active-snapshot submissions to CMS Forms; tenant notification requires verified tenant Email Sending and Site Settings contact email. |

## State Transitions

### Intake Submissions

Collection: `apps/cms/src/collections/IntakeSubmissions.ts`.

Statuses: `submitted`, `normalized`, `queued`, `generating`, `generated`,
`validating`, `applying`, `draft_ready`, `preview_ready`, `failed`.

Normal path:
`submitted -> normalized -> queued -> generating -> generated -> validating -> applying -> draft_ready -> preview_ready`.

Failure paths:

- Invalid normalization creates `submitted -> failed`.
- Generation, validation, or import errors move the intake and run to `failed`.
- Existing idempotency records are reused without creating a new transition.

### Site Generation Runs

Collection: `apps/cms/src/collections/SiteGenerationRuns.ts`.

Runs use the same workflow status enum as intake submissions but normally start
at `queued`.

Normal path:
`queued -> generating -> generated -> validating -> applying -> draft_ready -> preview_ready`.

Failure paths:

- Provider failure, invalid output, contract validation failure, or failed CMS
  apply result sets `failed`.
- `completedAt` is set when the run reaches `preview_ready` or `failed`.

### Page Status

Collection: `apps/cms/src/collections/Pages.ts`.

Statuses: `draft`, `published`.

- Generation import writes generated pages as `draft`.
- Page editor publish controls can change `draft <-> published`.
- Legacy/static projection hooks still project published pages to disk, but
  generic renderer output comes from active published snapshots.
- Snapshot publishing includes only run-linked pages whose CMS page status is
  already `published`.

### Approval

Stored as JSON on `site-generation-runs.clientApproval`.

- Preview data treats approval as missing/null, `pending`, or `approved`.
- Current approval action writes `{ status: "approved", approvedAt }`.
- No rejection, comment, revision-request, or unapprove state was found.

### Payment

Stored as JSON on `site-generation-runs.payment`.

- CMS payment logic lists `not_started`, `pending_provider`, `completed`, and
  `waived`.
- Current preview approval writes `pending_provider` unless the run already has
  a satisfied `completed` or `waived` payment state.
- Mollie checkout/webhook can update payment state after fetching the provider
  payment; super-admin operators can also mark payment `completed` or `waived`
  from `/generation-runs/[id]` with provider, external reference, actor,
  timestamp, and note metadata.
- Payment completion can trigger approved provider-side domain/sender
  provisioning, but payment state never publishes or activates a site by itself.

Ambiguity: payment status naming is centralized in CMS code, but not defined in
`packages/contracts`.

### Published Snapshot Status

Collection: `apps/cms/src/collections/PublishedSiteSnapshots.ts`.

Statuses: `drafted`, `active`, `superseded`, `rolled_back`.

- `publishSiteSnapshot` creates `drafted`.
- `activatePublishedSnapshot` changes the selected snapshot to `active`.
- Activation changes any other active snapshot for the tenant to `superseded`.
- Rollback activation changes prior active snapshots to `rolled_back`.
- Snapshot content fields are immutable after create; lifecycle fields can only
  change through the internal publish lifecycle context.

Ambiguity: `drafted` means a persisted immutable published snapshot that is not
active yet; it is distinct from CMS page drafts.

### Domain Verification

Stored on `tenants.domainVerification` in `apps/cms/src/collections/Tenants.ts`.

Statuses: `not_checked`, `verified`, `failed`.

- Default is `not_checked`.
- Activation requires `verified` when tenant data is passed to
  `canActivatePublishedSnapshot`.
- DNS pointing remains manual outside automation.
- A manual operator checklist on `/generation-runs/[id]` can write status,
  checked timestamp, checked-by user, and notes.
- No automated checker was found.

### Tenant Status

Collection: `apps/cms/src/collections/Tenants.ts`.

Statuses: `provisioning`, `active`, `suspended`, `archived`.

- Generated tenants are created as `provisioning` unless an existing tenant has
  a current status.
- Tenant edit UI can change status.
- Preview is blocked for `suspended` and `archived`.
- Publishing is blocked for `suspended` and `archived`.
- Activation sets tenant status to `active`, stores `activeSnapshot`, and sets
  `activatedAt`.
- Renderer lookup returns no snapshot unless tenant status is `active`.
- Tenant lifecycle hooks create, archive, restore, or remove tenant data
  directories when tenant status/delete events occur.

## Ambiguities Recorded

- Payment states are not centralized in `packages/contracts`.
- `drafted` snapshot status can be confused with CMS page `draft`; the current
  implementation keeps them separate.
- The preview approval button records approval and a provider-neutral pending
  payment handoff only.
- `POST /api/publish` performs publish, activation, and rollback depending on
  request body shape; there are no separate route names for those operations.
- Review notes/comments need a future storage contract before they can be
  collected inside signed previews.

## Phase 1 Review Notes

- Public customer, operator, CMS admin, and renderer perspectives are covered
  above.
- This phase changed documentation only.
- No generated tenant source folder, tenant workflow, tenant image, or product
  behavior was introduced.
