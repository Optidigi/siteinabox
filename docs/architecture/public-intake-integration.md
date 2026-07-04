# Public Intake Integration

Current architecture notes for the public intake surface at
`www.siteinabox.nl/intake`.

## Data Flow

1. The browser renders the richer intake wizard from `apps/intake` at `/intake`.
2. Optional KVK lookup calls CMS-owned endpoints under `/api/intake/kvk/*`.
3. The browser submits the completed intake payload to CMS `POST /api/intake`.
4. The CMS stores the raw submission and normalized `CompanyFacts` /
   `IntakeBrief` data in `intake-submissions`.
5. The CMS immediately starts the configured generation provider from the
   normalized intake and creates a traceable `site-generation-runs` record.
6. The provider must return a validated `SiteGenerationSpec`.
7. The CMS imports the valid spec as draft Payload tenant, page, settings, and
   media data.
8. Operators review the resulting generation run, preview, payment/domain
   state, and publish readiness in CMS.
9. The existing publish flow freezes approved draft data into a published
   snapshot.
10. `apps/renderer` serves the active published snapshot for the request host.

The public intake route may create draft CMS records through validated
generation output. It does not create snapshots, activate live sites, tenant
source folders, workflows, Docker images, or generated React/source code.

## Public App Boundary

- Public route: `apps/intake/src/pages/index.astro`.
- Submit endpoint: `PUBLIC_INTAKE_SUBMIT_ENDPOINT`, defaulting to `/api/intake`.
- KVK endpoints: `PUBLIC_KVK_SEARCH_ENDPOINT` and
  `PUBLIC_KVK_PROFILE_ENDPOINT`, defaulting to `/api/intake/kvk/search` and
  `/api/intake/kvk/profile`.
- Browser validation and serialization live in `apps/intake`; CMS validation
  remains authoritative at the API boundary.

Production should normally keep these endpoints same-origin and route
`/api/intake` and `/api/intake/kvk/*` to the CMS through the edge proxy. If a
public endpoint points at a different origin, that CMS origin must explicitly
allow CORS for `https://www.siteinabox.nl`.

## KVK Lookup

KVK is factual prefill only. It can help the user select a company name,
address, website, activities, and KVK number, but it does not decide the site
brief, generated copy, sections, theme, or publish state.

The browser never receives KVK credentials. `KVK_API_KEY` is read only by the
CMS KVK service in `apps/cms/src/lib/intake/kvk.ts`; public code calls the CMS
proxy endpoints. Missing keys, KVK failures, not-found results, and ambiguous
matches must leave manual intake submission possible.

## CMS Review And Generation

`POST /api/intake` validates the public payload, rejects unsupported/test-only
fields, stores the raw body, normalizes it into `CompanyFacts` and
`IntakeBrief`, records a stable normalized hash, and calls
`processStoredIntakeSubmission`. Normal intake submissions therefore start a
draft generation run automatically. Generic self-serve provider-backed block
variants are currently disabled, so new generation is blocked until exact-source
Tailwind Plus variants are reintroduced. The CMS review UI remains available for
inspection, recovery, and operator decisions before preview, payment, publish,
or activation.

Generation provider output is accepted only as structured
`SiteGenerationSpec` data matching shared contracts. The CMS validation/import
path creates or updates Payload draft data; it does not emit client-specific
source code.

## Publish And Renderer

Publish and renderer behavior is unchanged by the richer intake integration.
Publishing remains a CMS data operation that creates immutable published
snapshots from approved draft Payload data. The generic renderer resolves the
request host, loads the active snapshot, and renders it read-only.
