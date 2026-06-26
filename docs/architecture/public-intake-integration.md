# Public Intake Integration State

Phase 3 notes for the public intake surface at `www.siteinabox.nl/intake`.

## Current Wiring

- Public route: `apps/intake/src/pages/index.astro`, mounted at
  `www.siteinabox.nl/intake`.
- Submit endpoint: `PUBLIC_INTAKE_API_URL`, defaulting to `/api/intake`.
- Validation: browser-side validation uses
  `@siteinabox/contracts/generation` `IntakeSubmissionSchema` before POST.
- CMS validation: `apps/cms/src/lib/intake/publicIntakeValidation.ts` parses the
  same public intake schema, rejects unknown fields, rejects `mockFixture`, and
  forces `source: "public-intake"`.
- CMS processing: `apps/cms/src/lib/intake/processIntakeSubmission.ts`
  normalizes the intake, computes the idempotency key from normalized intake,
  creates or reuses `intake-submissions` and `site-generation-runs`, then
  applies generated CMS draft data.

The public form posts only structured intake data. It does not create tenant
source folders, tenant workflows, tenant images, or generated React/source code.

## Submitted Payload Shape

The public form sends an `IntakeSubmission` object:

- `businessName`, `domain`, contact fields, language, industry, service area,
  goals, requested pages, brand signals, and notes.
- `content.kvk.number` stores a manually entered KvK number for later
  enrichment.
- `content.kvk.enrichmentStatus` is currently `manual_not_enriched`.
- `content.consent.privacy` stores the required privacy-consent acknowledgement.

Normalization still belongs to the CMS intake service. The public app does not
submit `NormalizedIntake` directly because `POST /api/intake` is the current
public contract boundary.

## KVK Integration

No KVK lookup/enrichment client, server route, API key environment variable, or
rate-limit handling exists in this repo as of Phase 3.

Required future pieces:

- Server-side KVK client. Do not call KVK directly from browser code because the
  API key must remain secret.
- Environment variable for the KVK API key in the server-side app that performs
  enrichment, for example `KVK_API_KEY`.
- Timeout handling with manual continuation when KVK is unavailable.
- Rate-limit handling for the documented API limits: up to 300,000 queries per
  month and no more than 100 queries per second.
- Not-found and ambiguous-match handling so a user can continue manually.
- Enriched data mapping into the intake payload's structured `content.kvk`
  object before CMS submission.

The Dutch Chamber of Commerce developer portal documents the current API key
flow, endpoints, query limits, and error codes:

- Documentation: https://developers.kvk.nl/documentation
- FAQ: https://developers.kvk.nl/faq/apis

Relevant documented error modes include `400` invalid input, `401` not
authenticated, `404` not found/unavailable data, and `500` technical errors.
Those must all fall back to manual entry without blocking intake submission.

## Origin, CORS, and CSP

The preferred production deployment is same-origin:

- `https://www.siteinabox.nl/intake` posts to `/api/intake`.
- The edge proxy routes `/api/intake` to the CMS app.
- This avoids browser CORS preflight complexity and keeps the static site
  `connect-src 'self'` path viable.

If `PUBLIC_INTAKE_API_URL` points at another origin such as
`https://admin.siteinabox.nl/api/intake`, the CMS route must return CORS headers
for `https://www.siteinabox.nl`, including `OPTIONS` preflight support for
`Content-Type: application/json`. The static site CSP currently allows
`connect-src` to `https://admin.siteinabox.nl` as a fallback.

## Spam, Consent, Analytics, and Errors

- Spam: the public route includes a honeypot and the CMS middleware rate-limits
  anonymous `POST /api/intake` requests.
- Consent: submission is blocked until privacy consent is checked, and the
  acknowledgement is sent as structured intake content.
- Analytics: no public intake analytics event has been added in Phase 3. If
  analytics are added later, do not send free-text notes or contact fields to
  client-side analytics.
- Error display: browser validation errors are shown before POST. CMS/API
  failures are shown as user-safe messages without exposing stack traces.

## Retry and Failure Behavior

Duplicate/retry behavior is handled by the CMS service idempotency key derived
from normalized intake. Repeating the same normalized submission should reuse
the existing intake/run instead of duplicating CMS records.

Existing CMS unit tests cover:

- public validation rejecting unknown fields and `mockFixture`;
- failed generation avoiding tenant/page/settings mutations;
- repeated identical intake reusing the generation run.

KVK success, timeout, rate-limit, not-found, and manual fallback paths are not
testable yet because no KVK integration exists.
