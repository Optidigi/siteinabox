# PostHog Analytics Operations

SIAB uses one PostHog project as the canonical analytics backend for the
platform landing site, generated tenant sites, and authenticated CMS/product
usage analytics.

## Consent Boundary

The landing and tenant public sites initialize `posthog-js` only after
analytics consent is granted. Native PostHog events such as `$pageview`, `$pageleave`,
`$autocapture`, `$rageclick`, `$dead_click`, and `$web_vitals` are therefore
also consent-gated.

The authenticated CMS sends minimized semantic events through its authenticated
server endpoint without a public cookie banner. It does not initialize a second
CMS browser PostHog lifecycle SDK. This is first-party product analytics for
logged-in users, not public visitor tracking.
Keep the privacy boundary tight: session replay stays off, IP anonymization
stays on at the PostHog project level, and CMS events must not include raw form
content, rich text, email addresses, phone numbers, or user display names. Use
stable internal IDs plus role/tenant/domain context.

## Web Analytics Health Checks

PostHog's web analytics installation health checks map to SIAB as follows:

- `$pageview` and `$pageleave`: the canonical contract assigns both to the
  PostHog SDK. The renderer's intercepted-ingestion browser regression verifies
  one event of each kind per consented page lifecycle.
- Scroll depth: PostHog expects native `$prev_pageview_*` properties, including
  `$prev_pageview_max_content_percentage`, on `$pageleave` or the following
  `$pageview`. The site runtime keeps `disable_scroll_properties: false`.
  SIAB's `site_scroll_depth_reached` event is retained for CMS threshold views,
  but it does not satisfy PostHog's native scroll-depth health check by itself.
- Web Vitals: the site runtime enables client-side Web Vitals capture for
  `CLS`, `FCP`, `INP`, and `LCP`. The PostHog project/environment must also
  have Web Vitals and performance capture enabled server-side.
- Authorized URLs: this is the PostHog project/environment `app_urls` setting.
  When a production tenant domain becomes verified, the tenant lifecycle hook
  merges both `https://<domain>` and `https://admin.<domain>` if project API
  credentials are configured. The manual sync command remains the repair and
  reconciliation path.
- Reverse proxy: this is an infra/DNS concern. Keep it out of per-site runtime
  code until SIAB chooses a central or wildcard ingest proxy strategy.

## Sync Project Settings

Normally verified domains enroll automatically. Use the sync script to repair
a failed enrollment, reconcile existing tenants, or apply project privacy
settings:

```bash
POSTHOG_PERSONAL_API_KEY=phx_... \
POSTHOG_PROJECT_ID=12345 \
pnpm --dir apps/cms posthog:sync-settings -- --app-url https://ami-care.nl --app-url https://admin.ami-care.nl
```

For organization-scoped PostHog API deployments, also set
`POSTHOG_ORGANIZATION_ID`.

Multiple domains can be passed in one run:

```bash
POSTHOG_APP_URLS="https://ami-care.nl,https://admin.ami-care.nl,https://example.nl,https://admin.example.nl" \
POSTHOG_PERSONAL_API_KEY=phx_... \
POSTHOG_PROJECT_ID=12345 \
pnpm --dir apps/cms posthog:sync-settings
```

The script merges new URLs with existing `app_urls` and enforces the mutable
privacy baseline:

- `autocapture_web_vitals_opt_in`
- `autocapture_web_vitals_allowed_metrics`: `CLS`, `FCP`, `INP`, `LCP`
- `capture_performance_opt_in`
- `autocapture_opt_out: true`

Event retention is audited by the same command, but current PostHog project and
environment APIs expose `event_retention_months` and
`events_retention_enforced` as plan-derived read-only values. A personal API
key, including one with `project:write`, cannot change them. If the audit shows
retention drift, change the analytics retention entitlement through PostHog
billing/support and rerun `pnpm --dir apps/cms posthog:check-settings`. Do not treat the
30-day session-recording retention control as event retention.

Run with `--dry-run` to inspect the PATCH payload.

## Current Project State

This section is external-state evidence, not an executable repository fact.
Re-run the read-only check before relying on it.

PostHog MCP and API verification on 2026-07-11 confirmed project `SiteinaBox`
(`193842`) is configured with:

- `app_urls`: `https://ami-care.nl`, `https://admin.ami-care.nl`,
  `https://siteinabox.nl`, `https://admin.siteinabox.nl`
- CMS semantic tracking is enabled when `POSTHOG_PROJECT_TOKEN` is set and is
  sent by the authenticated server boundary. Site and CMS events are separated
  by `analytics_surface`; platform and tenant sites are separated by
  `site_kind`; tenant activity uses the native `tenant` PostHog group.
- `autocapture_opt_out: true`
- `autocapture_web_vitals_opt_in: true`
- `autocapture_web_vitals_allowed_metrics`: `CLS`, `FCP`, `INP`, `LCP`
- `capture_performance_opt_in: true`
- `anonymize_ips: true`
- `session_recording_opt_in: false`
- `heatmaps_opt_in: false`
- `capture_console_log_opt_in: false`
- `capture_dead_clicks: false`
- Event retention remains provider-managed at 84 months with enforcement
  disabled. The daily privacy audit intentionally remains red until PostHog
  changes the plan-derived values to 13 months with enforcement enabled.

PostHog SDK health reported healthy with no outdated SDKs. Fresh `$pageview`
events were present for `ami-care.nl`. CMS semantic events use
`analytics_surface: cms`; native public lifecycle and behavior events use
`analytics_surface: site`. Historic `site_page_viewed` and
`site_page_left` rows remain in PostHog data from earlier runtimes and browser
cache windows; the current tenant-site and Amicare source no longer emit
those event names.

Repository implementation now also covers the platform landing site and native
tenant grouping, but public capture is intentionally inactive until the legal
consent gate has a reviewed non-null version. Do not infer live landing events
or existing PostHog group types until an approved deployment and provider query
confirm them.

Live browser smoke on 2026-06-08 found that consent-and-idle SDK initialization
can miss PostHog JS's normal DOM-loaded initial pageview path. The public-site
runtime therefore calls `posthog.opt_in_capturing({ captureEventName: false })`
inside the SDK `loaded` hook after registering SIAB metadata. In the installed
PostHog JS SDK, this starts capture after consent and triggers the SDK-owned
initial `$pageview` without emitting a separate `$opt_in` event.

## Reverse Proxy Strategy

PostHog marks reverse proxy as an installation-health warning because direct
PostHog ingest can be blocked by privacy tooling. For SIAB, do not configure a
manual proxy per tenant site. Prefer one of these later strategies:

- a central neutral SIAB ingest hostname used by all sites;
- a wildcard tenant ingest hostname under a SIAB-controlled domain;
- per-customer CNAMEs only when the customer already controls DNS and accepts
  the operational work.

Avoid obvious tracking names such as `analytics`, `tracking`, `posthog`, or
`ph` in proxy hostnames.

## MCP Endpoint

Use PostHog's hosted MCP URL `https://mcp.posthog.com/mcp`. Current PostHog
docs state that authentication routes the user to the correct US or EU data
region after login, so repo-local MCP files should not hard-code regional
authentication endpoints.
