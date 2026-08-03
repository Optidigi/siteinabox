# Google Ads operations

This runbook defines the safe pre-launch and operating configuration for Site
in a Box advertising. It does not authorize campaign publication, billing
changes, budget allocation, or broader advertising consent.

## Account boundary

A dedicated Google Ads account exists for `Site in a Box` under the Optidigi
Google identity. Do not use or link the unrelated Superfunny account.

Current account invariants:

- Account name: `Site in a Box`
- Customer ID: `405-888-9317`
- Sole direct administrator: `admin@optidigi.nl`
- Linked manager accounts: none
- Time zone: Central European Time
- Currency: EUR
- Auto-tagging: enabled
- Auto-apply recommendations: disabled
- Campaign state: no campaigns and `€0.00/day`

Superfunny must not have direct user access, manager access, or another
administrative path into this account. Optidigi may separately administer
Superfunny-owned resources, but that one-way relationship must not grant
Superfunny visibility into or control over Site in a Box or Optidigi. Review
both the Users and Managers tabs after every access change.

The account is linked only to production GA4 property `543934308` (`Site in a
Box`), recorded in [`google-analytics.md`](./google-analytics.md). Importing
app and web metrics is enabled. Importing GA4 audiences is disabled. Do not
manually add `utm_source`, `utm_medium`, or `gclid` parameters to Google Ads
final URLs; use Ads tracking templates only when a documented downstream
system requires additional parameters.

## Conversion hierarchy

Smart bidding must optimize for verified business outcomes rather than every
click that indicates interest.

| GA4 event | Google Ads role | Reason |
| --- | --- | --- |
| `generate_lead` | Primary and account-default | Backend-accepted contact request |
| `intake_started` | Secondary / observation | Landing-to-intake handoff, not a confirmed submitted intake |
| `direct_contact_clicked` | Secondary / observation | Contact intent, not proof that a conversation occurred |

All three actions are imported from GA4 and use `One`/`Only one conversion`.
No fabricated monetary value is assigned. The `Contact` and `Engagement` goal
groups are not account-default goals and contain only secondary actions.
Google Ads therefore labels those two goal groups `Misconfigured`; this is an
expected UI consequence of keeping the events observable without making them
bidding targets. Do not resolve that warning by changing either action to
primary.

Replace the primary optimization signal with an opaque, server-confirmed
qualified-lead or won-customer event when the intake and sales lifecycle can
support it without exporting personal data.

Keep Google Signals, enhanced conversions, customer matching, remarketing, and
user-provided data collection disabled until each has a governed purpose,
consent behavior, retention decision, and legal review. Never send names,
email addresses, telephone numbers, form answers, Turnstile tokens, or raw
contact targets as Ads or Analytics event parameters.

## First campaign shape

Start with one tightly scoped Dutch Search campaign after billing and budget
approval:

- Campaign: `NL | Search | Non-brand | Website laten maken`
- Network: Google Search only at launch
- Location: Netherlands, using presence rather than presence-or-interest
- Language: Dutch
- Final URL: the most relevant production landing page
- Bidding: do not use conversion-based automation until primary conversion
  tracking is verified and has enough representative volume
- Brand traffic: keep in a separate campaign so it cannot obscure non-brand
  acquisition performance

Initial intent groups should remain small and mutually understandable:

- website laten maken
- website voor zzp or starter
- zakelijke website abonnement
- betaalbare professionele website

Build the negative keyword list from actual search terms. Seed obvious
non-commercial intent such as jobs, internships, courses, tutorials, templates,
and fully free DIY builders, but do not broadly exclude terms before reviewing
their intent.

Do not enable Display expansion, Search partners, broad match, Performance Max,
automatically created assets, or final URL expansion during the first
measurement period. Each can be tested later as an explicit experiment.

## Naming and campaign URLs

Google Ads auto-tagging is the acquisition source of truth. For non-Google
campaigns, use the repository's documented UTM convention:

- lowercase values
- stable `utm_source` and `utm_medium`
- a human-readable campaign theme in `utm_campaign`
- creative or placement detail in `utm_content`
- no personal data in any URL parameter

Record every campaign launch, major budget change, conversion-setting change,
and landing-page release as a GA4 annotation.

## Launch gate

Before publishing or funding a campaign:

1. Deploy the landing analytics runtime.
2. Validate `generate_lead`, `intake_started`, and
   `direct_contact_clicked` in GA4 Realtime and DebugView.
3. Confirm the GA4-to-Ads link and auto-tagging.
4. Import only the approved conversion actions and verify their primary or
   secondary role.
5. Test the full ad-click journey without personal data in URLs or events.
6. Confirm the landing page preserves the click identifier through redirects.
7. Confirm advertising consent behavior matches the governed cookie UI and
   privacy notice.
8. Review search terms, location settings, assets, negatives, bidding, daily
   budget, and account-level exclusions.
9. Obtain explicit approval for billing, budget, and publication.

During the first two weeks, review search terms and lead quality frequently.
Do not optimize around raw click-through rate when the business objective is a
qualified customer.
