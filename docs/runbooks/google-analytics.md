# Google Analytics 4 operations

This runbook covers the consented Google Analytics 4 configuration for the
static Site in a Box landing website. GA4 is not used for tenant sites or the
authenticated CMS.

## Production property

- Account: `Optidigi` (`399779567`)
- Property: `Site in a Box` (`543934308`)
- Web stream: `Site in a Box` (`15183036845`)
- Production URL: `https://siteinabox.nl`
- Measurement ID: `G-EM6YQ9893X`
- Reporting time zone: Netherlands
- Reporting currency: EUR

The measurement ID is a public identifier. Provider administration still
requires Editor or Administrator access and must never introduce API secrets
into the repository or static landing build.

## Collection and privacy controls

The landing loads `gtag.js` only after approved analytics consent. It grants
`analytics_storage` and keeps advertising storage, ad user data, ad
personalization, Google Signals, and ad-personalization signals disabled.
Google Signals and user-provided data collection must remain disabled in the
property unless the governed consent and legal scope are deliberately changed.

The web stream keeps email redaction enabled and redacts these URL query
parameter keys:

- `email`
- `phone`
- `telephone`
- `name`
- `message`
- `token`
- `cf-turnstile-response`

Campaign parameters such as `utm_source`, `utm_medium`, `utm_campaign`,
`utm_content`, and `utm_term` are intentionally preserved.

Event and user data retention are both 14 months. Internal Traffic and
Developer Traffic filters remain in `Testing` until their matching data has
been validated. The landing sets `debug_mode` only for development hosts so
the Developer Traffic filter can be validated without permanently discarding
data.

## Custom definitions

The property registers these event-scoped dimensions:

- `conversion_source`
- `action_key`
- `action_placement`
- `section_id`
- `journey_step`
- `form_state`
- `error_category`
- `billing_period`
- `item_id`
- `theme`
- `content_version`
- `environment`
- `component_id`
- `component_role`
- `form_id`
- `scroll_depth`
- `interaction_type`
- `destination_type`

Do not mirror GA4's standard acquisition, device, geography, page, or campaign
dimensions. Do not register visitor-entered values or parameters with
unbounded cardinality.

## Search and acquisition

The GA4 property is linked to the verified Search Console domain property
`siteinabox.nl` and the `Site in a Box` web stream. The domain property covers
all protocols and subdomains. Search Console has the production sitemap index
submitted at:

`https://siteinabox.nl/sitemap-index.xml`

The Search Console report collection is published in GA4. Search Console can
take several days to process a newly verified property and sitemap, so do not
submit duplicate sitemap entries while the first submission is pending.

Use GA4's Default Channel Group for acquisition reporting. It already includes
Google's maintained `AI Assistants` channel; do not create a duplicate custom
channel group with a manually maintained referrer regex unless a confirmed
source is being misclassified.

The property is also linked to the dedicated `Site in a Box` Google Ads
account (`405-888-9317`). Web metrics are shared, GA4 audience import remains
off, and only `generate_lead` is an account-default primary conversion.
Google Ads conversion roles, consent boundaries, campaign structure, and
launch gates are governed by [`google-ads.md`](./google-ads.md).

## Key events

The property defines these code-created key events. Each has no fabricated
default monetary value and counts at most once per session:

| Event | Trigger in the landing runtime | Meaning |
| --- | --- | --- |
| `generate_lead` | `conversion_source=contact_form` | Contact form accepted by the backend |
| `intake_started` | `conversion_source=intake_handoff` | Visitor leaves the landing site for intake |
| `direct_contact_clicked` | `conversion_source=contact_click` | Visitor opens telephone, email, or WhatsApp contact |

The canonical `site_conversion_completed` event is still sent to both
providers. GA4 additionally receives the matching business-specific key event
so its aggregate conversion reporting does not collapse unlike outcomes.

## Release validation

After deploying the landing:

1. Reject analytics consent and verify no Google tag request is made.
2. Accept analytics consent and verify one `page_view` in Realtime.
3. Exercise each outcome and verify the canonical event plus its matching key
   event in DebugView.
4. Verify event payloads contain no form values, email addresses, telephone
   numbers, Turnstile tokens, or raw contact targets.
5. Confirm development events carry `debug_mode` and appear under the
   `Developer Traffic` test-filter dimension.
6. Leave both data filters in `Testing` for at least 24 hours. Activate a
   filter only after its matches are correct; activation permanently discards
   matching future data.
7. Build acquisition, landing-funnel, CTA-placement, and form-friction
   explorations after the custom definitions have processed and production
   events are available. GA4 custom definitions and standard reports can take
   24–48 hours to populate.
