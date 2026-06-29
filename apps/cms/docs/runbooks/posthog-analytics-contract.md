# PostHog Analytics Contract

This document records the approved direction for the SIAB PostHog analytics
program. It is an implementation guide, not a mechanical script. Agents should
use it to preserve product/security decisions while still researching current
PostHog behavior, following local code patterns, and adapting implementation
details when the codebase or sibling repos make a better shape obvious.

If the purpose or product intent of an analytics field, event, or behavior is
unclear, pause and ask the operator before coding.

## Scope

OBS-99 is the parent planning and implementation item for SIAB analytics.
OBS-26, the tenant-facing website analytics dashboard, and OBS-22, dashboard
metrics/highlights, are part of the same implementation plan. OBS-27,
configurable dashboard charts, remains separate and should be picked up after
the fixed analytics views are trusted.

SIAB uses one shared PostHog project. Tenant, site, page, section, component,
build, and manifest metadata must be first-class event properties, and all CMS
query surfaces must enforce tenant/site filtering server-side.

## Consent

Analytics is a normal platform capability and should be enabled by default when
the required PostHog configuration exists. Public website visitor tracking only
becomes active after visitor consent.

Before consent, tenant public sites may keep memory-only, anonymous in-page
observations if needed for local behavior, but they must not transmit events to
PostHog, write cookies, write localStorage/sessionStorage, identify a visitor,
or create a cross-page/session profile.

Do not treat `posthog-js` memory persistence alone as enough to send
pre-consent analytics. Network events can still involve personal data or
terminal/device access. A later legal/privacy review may loosen this only if the
exact implementation satisfies the applicable Dutch/EU analytics-cookie
exception and GDPR anonymisation threshold.

## Public-Site Events

Approved V1 tenant-site events:

- `$pageview`
- `$pageleave`
- `site_page_viewed`
- `site_page_left`
- `site_section_viewed`
- `site_section_engaged`
- `site_component_viewed`
- `site_scroll_depth_reached`
- `site_journey_step`
- `site_form_started`
- `site_form_submitted`
- `site_form_accepted`
- `site_conversion_completed`
- `$web_vitals`
- `$autocapture`
- `$rageclick`
- `$dead_click`

V1 starts from the trusted business events and adds a deeper behavioral layer.
`site_page_viewed` is the curated base traffic event. `$pageview` and
`$pageleave` keep PostHog's native web analytics/product surfaces useful.
`site_page_left`, `site_scroll_depth_reached`, and `site_journey_step` support
journey and content-depth analysis. `site_section_viewed`,
`site_section_engaged`, and `site_component_viewed` support section/component
performance and exposure analysis. `$autocapture` is the canonical browser
interaction stream for CTA/contact/nav clicks after consent. Form events support
funnels and lead intelligence.
`site_form_submitted` captures browser-side submission intent.
`site_form_accepted` is the trusted server-side accepted lead signal after
validation, rate limiting, and spam handling.
`site_conversion_completed` is the normalized business conversion rollup event.
`$web_vitals` is the canonical Web Vitals stream emitted by PostHog JS.
`$rageclick` and `$dead_click` are friction diagnostics.

This event set is approved for implementation, but agents should still research
current PostHog behavior and review the live code paths before changing it. The
runbook preserves the product/security intent; it must not be treated as a
limit on useful implementation, verification, or review.

## Conversion Model

Default conversion semantics:

- `site_form_accepted` always counts as a conversion.
- `site_form_submitted` is a funnel and diagnostics signal, not a conversion.
- Phone, email, WhatsApp, and similar contact clicks become conversions only
  when the tenant/site analytics contract marks those target types as conversion
  goals.
- `site_conversion_completed` is emitted for every accepted form and for any
  configured contact-intent conversion goal.

This keeps tenant-facing conversion rates tied to trusted lead capture while
still allowing contact-heavy sites to opt specific contact actions into the
conversion model.

## Event Metadata

Every public-site event carries:

- `schema_version`
- `environment`
- `tenant_id`
- `tenant_slug`
- `site_id`
- `site_domain`
- `page_id`
- `page_slug`
- `page_path`
- `theme_id`
- `site_build_id`
- `manifest_version`
- `session_id`
- `device_type`
- `referrer_domain`
- `referrer_type`
- `$geoip_country_code`
- `$geoip_country_name`
- `$geoip_city_name`

Section/component events additionally carry:

- `section_id`
- `section_type`
- `section_position`
- `section_anchor`
- `section_variant`
- `block_preset_id`
- `content_signature`

Behavioral events additionally carry:

- `journey_step_index`
- `journey_step`
- `journey_from`
- `scroll_depth`
- `page_duration_ms`
- `component_type`
- `component_role`
- `component_view_count`
- `component_viewed_before_interaction`
- `component_visible_ms_before_interaction`
- `component_hover_ms_before_interaction`
- `component_time_to_interaction_ms`
- `interaction_type`

Web-vitals events additionally carry:

- `web_vital_name`
- `web_vital_value`
- `web_vital_rating`
- `web_vital_id`

CTA/contact events additionally carry:

- `action_id`
- `action_role`
- `action_label`
- `action_key`
- `target_type`
- `target_domain`
- `target_path`

Rules:

- Do not send raw `mailto:` or `tel:` hrefs.
- Internal links may store safe path/hash.
- External links may store domain and, where useful, sanitized path; strip query
  strings by default.
- `action_label` may contain CMS-authored button or link text, but never
  user-submitted data.
- `content_signature` is a stable hash of sanitized block content/shape, never
  raw rich text or private content.
- Every event uses `schema_version: 1` so later taxonomy/schema changes can be
  queried without breaking V1 dashboards.

## Metadata Source Model

Analytics metadata is projection-owned. Generated sites should not invent
tenant/page/section metadata at runtime. Payload projection emits stable
analytics metadata into generated `site.json` and page JSON, and the
tenant-site runtime mostly reads and forwards that data.

Source model:

- `tenant_id`, `tenant_slug`, `site_id`, and `site_domain` come from Payload
  tenant/site settings projection.
- `page_id`, `page_slug`, and `page_path` come from each projected page.
- `theme_id` and `manifest_version` come from the tenant manifest/theme
  pipeline.
- `site_build_id` is injected by the tenant site build or deploy
  path, preferably commit SHA or image revision.
- `section_type`, `section_position`, and `section_anchor` come from page block
  projection.
- `section_id` uses the explicit anchor where present; otherwise projection
  emits a stable fallback such as page slug + section position + block type.
- `section_variant` and `block_preset_id` are optional in V1 and may be null
  until block variants/presets are formalized.
- `content_signature` is generated during projection from sanitized block
  shape/content and must not expose raw rich text or private content.

The runtime may derive only request/browser-local facts such as current URL,
referrer, device hints, visibility timing, and sanitized clicked-target details.

## Settings Contract

Analytics is platform-enabled by default when PostHog configuration exists, but
public tracking is consent-gated per the site analytics contract. The V1
analytics contract is operator-managed, not a broad tenant-editable settings
surface.

Projected V1 fields:

- `enabled`
- `provider: "posthog"`
- `consentMode: "required"`
- `posthogHost`
- `posthogProjectToken`
- `conversionGoals.acceptedForms: true`
- `conversionGoals.contactClicks`
- `dashboardVisible`

Defaults:

- `enabled: true`
- `provider: "posthog"`
- `consentMode: "required"`
- `conversionGoals.acceptedForms: true`
- `conversionGoals.contactClicks: []`
- `dashboardVisible: true`

Accepted forms are always conversions. Contact clicks remain contact-intent
signals by default and become conversions only when the operator-managed site
contract includes their target type, such as `phone`, `email`, or `whatsapp`,
in `conversionGoals.contactClicks`.

## Generated-Site Runtime

`packages/site-renderer` / `apps/renderer` should ship a small first-party
analytics runtime. It is generic and not theme-specific.

Runtime responsibilities:

- Read projected analytics config plus page/block analytics metadata.
- Wait for visitor analytics consent before initializing PostHog capture.
- Emit `site_page_viewed` once per page load after consent.
- Observe sections and emit `site_section_viewed` and
  `site_section_engaged` once per section per page load.
- Enrich PostHog autocaptured CTA/contact/nav clicks through delegated click
  listeners without also sending duplicate custom click events.
- Track form start/submit through delegated form listeners.
- Include projected metadata on every event.
- Never transmit pre-consent analytics events.
- Load PostHog JS only after consent and idle.
- Keep SDK-native `$pageview` and `$pageleave` disabled while SIAB emits those
  directly, and use SDK-native `$web_vitals` for Web Vitals instead of manual
  browser performance observers.

Approved thresholds:

- `site_section_viewed`: section is at least 50% visible for 500 ms.
- `site_section_engaged`: section is visible for 3 seconds total, or a
  click/focus/input occurs inside it.
- `site_form_started`: first focus/input in a form.
- `site_form_submitted`: browser submit event before the network response.
- `site_scroll_depth_reached`: first time each visitor reaches 25%, 50%, 75%,
  or 90% page depth during the page load.
- `site_page_left`: emitted on `pagehide` with page duration and maximum scroll
  depth.
- `$autocapture`: delegated PostHog click/change/submit tracking enriched with
  section, component role, timing, sanitized target metadata, and
  `siab_autocapture: true`.
- `site_component_viewed`: first time each tracked link/button is at least 50%
  visible for 500 ms during the page load.
- `$web_vitals`: PostHog JS Web Vitals event emitted after consent with
  `$web_vitals_<metric>_value` and `$web_vitals_<metric>_event` properties for
  LCP, INP, CLS, and FCP in the installed SDK version.
- `$rageclick` and `$dead_click`: optional friction diagnostics emitted by the
  PostHog SDK after consent. They are internal discovery signals, not canonical
  conversion or CTA metrics.

Default SDK guardrails:

- `capture_pageview: false`
- `capture_pageleave: false`
- `capture_performance.web_vitals: true`
- session recording disabled
- heatmaps disabled
- console log capture disabled
- copied text capture disabled
- element attributes such as `value`, `placeholder`, `name`, `aria-label`, and
  `title` ignored
- `before_send` drops every SDK event except `$autocapture`, `$rageclick`,
  `$dead_click`, and `$web_vitals`
- `site_journey_step`: ordered page-level journey steps such as page viewed,
  action clicked, form started, and form submitted.
- `site_form_accepted`: server-side CMS/Payload event only.
- `site_conversion_completed`: server emits for accepted forms; browser emits
  only for configured contact-click conversion goals after consent.

Consent handoff:

```ts
window.SIABAnalytics?.grantConsent()
window.SIABAnalytics?.revokeConsent()
```

Until a consent component grants consent, public-site PostHog tracking remains
inactive.

## CMS Query Layer

`siab-payload` should use a dedicated server-only analytics module rather than
ad hoc PostHog calls in pages or components.

Proposed module shape:

- `src/lib/analytics/config.ts`
- `src/lib/analytics/events.ts`
- `src/lib/analytics/posthogClient.ts`
- `src/lib/analytics/queries.ts`
- `src/lib/analytics/access.ts`
- `src/lib/analytics/redaction.ts`

Responsibilities:

- Read PostHog environment/configuration and return enabled/disabled state.
- Capture server-side CMS/product and accepted-form events.
- Query PostHog from the server only; never expose query credentials to the
  browser.
- Keep typed event names and property schemas.
- Enforce tenant/site access before every analytics query.
- Redact or reject disallowed event properties before capture.
- Return curated, UI-safe analytics data rather than raw PostHog responses.

Initial query helper surface:

- `getSiteAnalyticsOverview({ tenantId, days })`
- `getSiteTrafficSeries({ tenantId, days })`
- `getTopPages({ tenantId, days })`
- `getTopCtas({ tenantId, days })`
- `getSectionPerformance({ tenantId, days })`
- `getComponentPerformance({ tenantId, days })`
- `getJourneySteps({ tenantId, days })`
- `getScrollDepth({ tenantId, days })`
- `getGeoCountries({ tenantId, days })`
- `getGeoCities({ tenantId, days })`
- `getDashboardHighlights({ tenantId, days })`

Access rules:

- Tenant-mode users may query only their own tenant.
- Super-admins may query any tenant and later SIAB-wide internal views.
- If PostHog config is missing or disabled, the analytics page renders an
  unavailable/empty state and the dashboard keeps existing local Payload
  stats/activity without runtime errors.

## Tenant-Facing Analytics

V1 `/analytics` should answer whether the site is working without exposing
SIAB's full internal intelligence layer.

Tenant-facing V1 shows:

- Overview cards: visitors, pageviews, conversions, conversion rate, CTA clicks,
  and accepted form submissions.
- Traffic trend: pageviews and visitors over time, with 7/30/90 day ranges if
  cheap to support in V1.
- Top pages: page, views, visitors, conversions, and conversion rate.
- CTA/contact performance: label/role/type, clicks, and conversion-goal marker
  where applicable.
- Forms funnel: started, submitted, accepted, and acceptance rate.
- Basic section performance: section name/type/page, views, engagements, CTA
  clicks inside the section, and conversion assists only if reliable.
- Component/nav performance: component type/role, section type, interactions,
  and unique visitors.
- Journey depth: ordered journey steps, page-leave duration, and scroll-depth
  buckets.
- Geography: aggregated countries and cities from PostHog GeoIP enrichment.
- Traffic sources and device split.

Keep internal-only in V1:

- Raw event streams
- Individual visitor/person profiles
- Session replay
- Cross-tenant benchmarks
- Exact section/component scoring formulas
- Experiments/feature flags
- Unvalidated inferred recommendations

Dashboard highlights consume the same analytics query layer but show only a
small summary such as visitors 30d, conversions 30d, conversion rate, and top
page or top CTA. Existing local Payload activity remains available where it is
still the right source of truth.

## Cross-Repo Responsibilities

`siab-payload` owns analytics contract docs, site/page/block analytics metadata
projection, CMS/server event capture, `site_form_accepted` capture, the
server-only PostHog query layer, `/analytics`, and dashboard highlights.

`packages/site-renderer` / `apps/renderer` ships the first-party tenant-site
analytics runtime, reads projected `site.analytics`, `page.analytics`, and
`block.analytics`, emits the approved public-site V1 events after consent, exposes
`window.SIABAnalytics.grantConsent()` / `revokeConsent()`, and tests emitted
metadata plus no pre-consent transmission.

Future generation must include analytics support in validated structured site
metadata and must verify that analytics runtime/metadata exists or is
intentionally disabled.

Approved automation seeds operator-managed analytics config into Payload and
checks PostHog environment/configuration plus public-site analytics metadata.

Existing tenant sites, including Amicare, need a normal template/runtime
backport or site-specific integration. They are not complete until events appear
in the shared SIAB PostHog project with correct tenant/site metadata.

## Implementation Order

Use this order as a default path. If research or code review reveals a better
sequence, preserve the approved contracts and adjust pragmatically.

1. `siab-payload` contract docs, projection metadata, and server query helper
   skeleton.
2. `packages/site-renderer` / `apps/renderer` tenant-site runtime.
3. Existing tenant backport.
4. Future generation contract once the platform architecture is approved.
5. CMS `/analytics` page and dashboard highlights.
6. Production smoke for consent, event capture, accepted form conversion, and
   tenant-filtered queries.

## Closure Gate

OBS-99 closes only after end-to-end analytics is proven for at least one
production tenant, not merely when code exists.

Approved closure criteria:

- Shared SIAB PostHog project configuration is deployed.
- Public site runtime is consent-gated: no PostHog events, cookies,
  localStorage, or sessionStorage before consent; events flow after consent.
- All public-site V1 events appear in PostHog with correct V1 metadata:
  `site_page_viewed`, `site_section_viewed`, `site_section_engaged`,
  `site_form_started`, `site_form_submitted`, `site_form_accepted`,
  `site_conversion_completed`, `$autocapture`, and `$web_vitals`.
- Accepted forms emit server-side `site_form_accepted` and the conversion rollup
  event.
- `/sites/[slug]/analytics` renders tenant-filtered curated analytics data.
- Tenant users cannot query another tenant's analytics.
- Super-admins can view tenant analytics.
- CMS analytics pages render through the same route on refresh and client
  navigation. Mobile layouts may be dense, but they must not hide the page or
  redirect away from analytics.
- Dashboard shows the approved analytics highlights and keeps local activity
  fallback where appropriate.
- Future approved site generation inherits analytics runtime/configuration.
- At least one existing tenant rollout, initially Amicare, is verified.
- Tests cover redaction/allowlisting, missing-config fallback, tenant query
  access, metadata projection, no pre-consent transmission, and accepted-form
  event capture.
