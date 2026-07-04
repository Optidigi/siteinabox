# OBS-81 Settings Contract Cleanup Plan

Status: implemented for projection, 2026-06-05.

OBS-81 should not start with schema deletion. The current app has three layers
that must be kept compatible while the settings contract becomes authoritative:

- `siteManifest.settings` and `resolveSettingsContract()` define the
  client-facing settings surface.
- `SettingsForm` already renders from that resolved contract.
- `SiteSettings` storage and `settingsToJson()` still project legacy fields
  whenever data exists, regardless of whether the manifest declares support.

## Target Shape

`siteManifest.settings` should be the source of truth for client-facing settings
storage and projection. A tenant should only project optional Settings-page
surfaces when its manifest explicitly declares them, except for core
identity/operations fields that remain part of the slim default contract.

The default contract stays intentionally slim:

- General: site name, site URL, description.
- Brand: logo and favicon.
- Operations: maintenance and GDPR/export affordances.

Tenant-specific details such as language, contact email, NAP/business
identifiers, service area, and opening hours should be projected only when the
manifest contract enables those fields.

Footer tagline/copyright are not Settings-page fields. They belong to the page
editor chrome flow and should continue to project through `chrome.footer.*`
independently of `siteManifest.settings`.

## Proposed Implementation Slices

1. Thread the resolved settings contract into projection.

   Change `settingsToJson(doc, publishedPages, analyticsContext)` to accept an
   optional fourth projection-context argument with `settingsContract`. Gate
   optional Settings-page fields by contract:

   - `description`: `general.description`
   - `language`: `general.language`
   - `contactEmail`: `general.contactEmail`
   - `branding.logo/favicon`: `identity.branding`
   - `contact.*`: `details.contact`
   - `nap.*`: `details.business`
   - `hours`: `details.hours`
   - `serviceArea`: `details.serviceArea`
   - `maintenance`: `operations.maintenance`

   Navigation, analytics metadata, and chrome/footer column composition should
   stay projected because those are separate site runtime/page-editor
   contracts, not the client Settings page surface.

2. Update projection callers.

   In `projectToDisk`, load the tenant manifest already associated with the
   settings/page projection and pass the resolved projection contract into
   `settingsToJson()`. Tenants are expected to have `siteManifest.settings`;
   when a caller omits a contract, projection uses the slim default contract.

3. Preserve Amicare explicitly.

   Add the current Amicare-supported settings groups to its manifest data rather
   than relying on hardcoded fallback projection. If that manifest lives outside
   this repo, coordinate the same change with the site/template repo before
   flipping projection defaults here.

4. Add migration only after contract behavior is stable.

   Do not remove `SiteSettings` fields in the first implementation slice. Once
   projection is contract-gated and existing tenants declare their supported
   settings explicitly, create a separate migration/schema cleanup plan for
   fields proven obsolete.

## Test Plan

- Update `settingsToJson.test.ts` so slim default omits disabled optional
  details even when the database document still has values.
- Add an explicit contract test proving enabled optional fields still project.
- Keep current chrome/footer/navigation projection tests, with a note that those
  are runtime site contracts rather than Settings page fields.
- Add a project-to-disk unit test proving the tenant manifest contract is passed
  into settings projection.

## Decision Outcome

- Tenants are expected to declare `siteManifest.settings`; no broad legacy
  projection fallback is supported.
- Footer tagline/copyright belong only to the page-editor chrome flow.
- If Amicare needs optional settings such as language, contact, NAP, hours, or
  service-area support, the Amicare manifest source must declare them.

Follow-up 2026-06-05: the Amicare settings manifest declares the optional
settings contract for description, language, contact email, brand logo/favicon,
contact details, business/NAP fields, service area, hours, and maintenance.
Footer tagline/copyright remain omitted from the Settings contract.
