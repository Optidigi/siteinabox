# PostHog Analytics Operations

SIAB uses one PostHog project as the canonical analytics backend for the
platform landing site, generated tenant sites, and authenticated CMS/product
usage analytics.

## Consent Boundary

The landing and tenant public sites initialize one `posthog-js` instance in
`cookieless_mode: "on_reject"`. Pending/refused visitors emit only minimized
`$pageview` and `$web_vitals` events with `analytics_tier: baseline`; the SDK
stores no PostHog cookie/local/session identifier or person profile. Consent
enables `analytics_tier: consented` lifecycle, interaction, tenant grouping,
and semantic events. Refusal does not disable the minimized baseline.

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
  PostHog SDK. The baseline permits one minimized pageview; pageleave remains
  consented. The landing and renderer intercepted-ingestion browser regressions
  verify one event of each kind per consented lifecycle after a stored choice,
  plus a single non-duplicated baseline pageview during consent transition.
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
- `cookieless_server_hash_mode: 1` (stateless)

Event retention is audited by the same command, but current PostHog project and
environment APIs expose `event_retention_months` and
`events_retention_enforced` as plan-derived read-only values. A personal API
key, including one with `project:write`, cannot change them. If the audit shows
retention drift, compare it with the accepted provider constraint in SIAB-002.
The current 84-month, unenforced value is owner-accepted; a value beyond that
or a newly available 13-month enforcement control reopens review. Do not treat
the 30-day session-recording retention control as event retention.

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
  disabled. The owner accepted this external constraint on 2026-07-18. The
  strict audit continues to expose the difference from the 13-month governance
  target as a monitoring signal; it is not outstanding implementation work.

PostHog SDK health reported healthy with no outdated SDKs. Fresh `$pageview`
events were present for `ami-care.nl`. CMS semantic events use
`analytics_surface: cms`; native public lifecycle and behavior events use
`analytics_surface: site`. Historic `site_page_viewed` and
`site_page_left` rows remain in PostHog data from earlier runtimes and browser
cache windows; the current shared tenant-site runtime no longer emits those
event names.

Repository implementation covers the platform landing site, dynamic tenant
sites, and native tenant grouping. Consent version `2026-07-07.1` is approved.
The runtime contract now uses a minimized cookieless baseline before a choice
and after refusal, with richer analytics only after acceptance. Commit
`99dced376397b6ce3cb89a37da4cb9290fd3c798` is deployed to the landing,
renderer, and CMS production containers. Local and CI intercepted-ingestion
regressions decode the tiered payloads and prevent real analytics writes. A
2026-07-18 intercepted production-browser probe decoded one minimized baseline
`$pageview` for both `siteinabox.nl` and `ami-care.nl`, with no PostHog
persistence or sensitive query properties. The reviewed production sync then
enabled `cookieless_server_hash_mode: 1`; the strict recheck reports only the
owner-accepted SIAB-002 retention difference. Real production probes received
successful ingestion responses, but their baseline rows were not immediately
queryable. Provider event materialization remains the final activation proof.
Existing PostHog group types still require a provider query; browser capture
proves emitted group metadata, not provider-side group materialization.

Generated tenant manifests receive this approved consent policy automatically.
The migration `20260718_123000_backfill_public_analytics_consent` adds it only
to existing tenant manifests where `analyticsConsent` is absent; explicit
tenant choices are not overwritten. The landing GHCR workflow separately
requires the Actions secret `POSTHOG_PROJECT_TOKEN` and fails closed when that
build input is missing.

The public-site runtime calls
`posthog.opt_in_capturing({ captureEventName: false })` after accepted consent.
The installed SDK resets cookieless state before starting persistent capture,
without emitting a separate `$opt_in` event. Automated production probes must
neutralize both `navigator.webdriver` and headless browser brands: PostHog
intentionally drops detected bot events, which otherwise creates a false
negative while still showing successful SDK initialization.

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
