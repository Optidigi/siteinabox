# Analytics contract

This document describes the current SIAB analytics contract. Executable event
names, ownership, governance, redaction, and queries remain canonical in:

- `apps/cms/src/lib/analytics/events.ts`
- `apps/cms/src/lib/analytics/contract.ts`
- `apps/cms/src/lib/analytics/governance.ts`
- `apps/cms/src/lib/analytics/redaction.ts`
- `apps/cms/src/lib/analytics/identity.ts`
- `apps/cms/src/lib/analytics/queries.ts`
- `apps/landing/src/scripts/analytics.ts`
- `apps/renderer/src/client/analytics-runtime.ts`

When this document and those sources disagree, treat the difference as a
finding rather than adding another event or compatibility path. Active runtime
deviations are recorded in `docs/findings.md`.

## Boundaries

SIAB uses one shared PostHog project for consent-gated platform/tenant-site
analytics and first-party authenticated CMS product analytics. `site_kind`,
`analytics_surface`, and tenant/site/page metadata distinguish those surfaces.
Tenant events also use PostHog's native `tenant` group type with the stable
Payload tenant ID as group key.

- Public browser analytics require explicit analytics consent.
- The authenticated CMS may capture minimized first-party product analytics
  without the public-site cookie banner.
- Server-side accepted-form conversion outcomes use legitimate interest and do
  not include submitted form content or direct identifiers.
- Analytics configuration is projected from CMS-owned tenant/site data. The
  renderer must not invent tenant or page identity.
- Verified production tenant domains are idempotently added to PostHog's
  authorized URL list by the tenant lifecycle hook when provider credentials
  are available. Provider failure does not roll back authoritative domain
  state.
- CMS queries are server-only and tenant-filtered before PostHog is queried.

## Event ownership

The event lists in `events.ts` and the entries in `contract.ts` are the typed
event inventory. Do not add an event only in prose.

| Owner | Events | Canonical use |
| --- | --- | --- |
| PostHog JS | `$pageview`, `$pageleave`, `$web_vitals`, `$autocapture`, `$rageclick`, `$dead_click`, `$groupidentify` | Native page lifecycle, field performance, interaction, friction, and tenant-group identity |
| SIAB browser runtime | `site_section_viewed`, `site_section_engaged`, `site_component_viewed`, `site_scroll_depth_reached`, `site_journey_step`, `site_form_started`, `site_form_submitted` | Consent-gated semantic exposure, engagement, journey, and form-funnel signals |
| SIAB browser or server conversion path | `site_conversion_completed` | Configured contact-click goals in the browser and accepted-form conversion rollups on the server |
| SIAB server | `site_form_accepted` | Trusted accepted-form outcome after server validation |
| Authenticated CMS | Events in `CMS_EVENT_NAMES` | Minimized CMS navigation, action, editor, media, form, settings, and friction signals |

`site_page_viewed` and `site_page_left` are historical names. Current contracts
and queries use native `$pageview` and `$pageleave`; do not emit the historical
events or add compatibility queries for them.

Native and semantic events must not count the same interaction twice:

- SIAB does not define a second pageview or pageleave event.
- CTA/component interaction counts use enriched `$autocapture`; journey events
  provide ordered context rather than another click total.
- `site_scroll_depth_reached` records threshold milestones, while native
  `$pageleave` properties drive PostHog-compatible scroll-depth reporting.
- `site_form_submitted` is browser intent. `site_form_accepted` is the trusted
  backend outcome.
- Accepted forms emit `site_form_accepted` and one
  `site_conversion_completed` rollup. Configured phone, email, or WhatsApp
  goals emit `site_conversion_completed` after consent.

## Consent and SDK controls

Before consent, the landing site and a tenant public site must not initialize
PostHog, transmit analytics, identify a visitor, or create analytics
cookies/localStorage/sessionStorage.
The approved consent UI calls:

```ts
window.SIABAnalytics?.grantConsent()
window.SIABAnalytics?.revokeConsent()
```

After consent, the renderer may initialize PostHog and the semantic observers.
Revocation opts out, resets the client, and removes SIAB analytics identifiers.

Public-site SDK controls keep:

- session recording, heatmaps, surveys, console capture, and copied-text
  capture disabled;
- Web Vitals limited to CLS, FCP, INP, and LCP;
- autocapture limited to approved element/event types;
- form-like attributes such as `value`, `placeholder`, `name`, `aria-label`,
  and `title` excluded;
- `before_send` restricted to approved native event names and stripped of
  element text/chains.

The operational PostHog configuration and provider-state checks live in
`docs/runbooks/posthog.md`.

## Metadata and redaction

All analytics uses `schema_version: 1`, identifies `analytics_surface` as
`site` or `cms`, and identifies `site_kind` as `platform` or `tenant`. Tenant
events carry `$groups: { tenant: <tenant_id> }`; group metadata is limited to
tenant name, slug, domain, and site kind. Common projected properties include
environment, tenant/site identity, domain, page identity/path, theme, build,
and manifest version.

Section events may add stable section identity/type/position, provider variant,
block preset, and a sanitized content signature. Interaction events may add a
stable action key/role/label, sanitized target type/domain/path, component
timing, journey position, referrer category, device category, or scroll depth.

Privacy rules:

- Never send submitted form values, email addresses, phone numbers, rich text,
  display names, authentication data, or secrets.
- Never send raw `mailto:` or `tel:` targets.
- Strip query strings from target and CMS action paths.
- Labels may contain CMS-authored interface text, never visitor input.
- Content signatures are hashes of sanitized structure/content, not raw
  content.
- Server capture passes properties through the allowlist in `redaction.ts`.

The governance policy requires no direct identifiers and defines a 13-month
retention target. Provider retention currently differs; see SIAB-002.

## Public runtime behavior

The renderer reads projected analytics configuration and page/block metadata.
Every newly published tenant snapshot receives this configuration from the
same CMS projection path; there are no per-tenant source trees or manual SDK
snippets. After consent it:

- starts PostHog when the projected token and host are available;
- observes section exposure and engagement;
- observes action exposure and enriches native autocapture;
- records form start and submit intent;
- records 25%, 50%, 75%, and 90% scroll milestones;
- records ordered journey steps;
- records configured contact conversions; and
- captures approved Web Vitals.

Current visibility thresholds are 50% for 500 ms for a view and three seconds
or an interaction for section engagement. These values are implementation
constants and must change together with focused tests and query expectations.

Public analytics defaults to enabled only when capture configuration exists,
uses PostHog, requires consent, treats accepted forms as conversions, and keeps
contact-click conversion goals empty unless explicitly configured.

The static landing site uses the same consent, lifecycle-ownership, property,
and privacy rules with `site_kind: platform` and no tenant group. Both public
runtimes remain fail-closed while the governed legal consent approval version
is null; see `packages/legal-content/src/consent-approval.js` and SIAB-012.

## Server capture and CMS queries

When CMS accepts a public form, `acceptedForm.ts` emits a minimized
`site_form_accepted` event and matching `site_conversion_completed` event with
a stable site-scoped distinct ID. It excludes form ID, form name, submitted
values, and URL query parameters.

The server query layer:

- returns an unavailable/empty result when query credentials are absent;
- scopes site analytics by tenant and optional site/domain/time range;
- permits tenant users to query only their tenant;
- permits super-admins to query tenant or aggregate CMS views;
- separates site queries from CMS queries with `analytics_surface` before
  applying tenant and time filters; historical public events without the
  property remain site events, while CMS events must explicitly use `cms`;
- attributes tenant-host CMS activity automatically from `getSiabContext()`;
- attributes super-admin activity below `/sites/<slug>` only after resolving
  the slug to a tenant on the server;
- presents aggregate platform and per-tenant CMS usage to super-admins while
  tenant analytics pages remain limited to their own public-site metrics;
- uses `$pageview` for visitors, traffic, sources, and device splits;
- uses `site_conversion_completed` and `site_form_accepted` for conversion
  reporting;
- uses enriched `$autocapture` for CTA/component interactions; and
- uses native `$pageleave` properties for PostHog-compatible scroll depth.

Curated helpers in `queries.ts` are the supported query surface. UI code must
not issue ad hoc PostHog queries or expose personal API credentials to the
browser.

## Change verification

For analytics changes, run the focused CMS analytics tests and renderer tests,
then the broader checks required by `docs/engineering.md`. At minimum verify:

- event inventory and event-contract uniqueness;
- governance coverage and legal basis;
- property redaction;
- tenant query access;
- accepted-form minimization;
- no transmission before consent;
- native/semantic duplicate prevention; and
- missing-configuration behavior.

Reverify provider settings through `docs/runbooks/posthog.md` when a change
depends on external PostHog state. Do not infer provider state from repository
configuration alone.
