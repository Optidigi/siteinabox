# Tenant Data Migration Fixtures

Amicare and Amblast are now represented as `SiteGenerationSpec` and
`PublishedSiteSnapshot` fixtures in `@siteinabox/contracts/fixtures/tenants`.
These fixtures are validation data for the data-driven renderer model; the
legacy sites under `sites/*` remain temporary renderers and were not used as a
new generation pattern.

## Current Mapping

- Site settings: tenant name, URL, contact data, NAP/business data, hours,
  header/footer navigation, footer composition, branding, and aliases where
  known.
- Pages: Amicare home; Amblast home, over ons, diensten, portfolio, and contact.
- Blocks: existing canonical `hero`, `featureList`, `richText`, `cta`, and
  `contactSection` blocks cover the tenant content model.
- SEO: page titles, descriptions, and available OG/media references are included
  in the page `seo` fields.
- Media: referenced logos, OG images, hero images, and representative portfolio
  assets are present in the published snapshot `media` list and manifest.
- Theme: tenant differences are expressed with `ThemeTokenSpec` colors, fonts,
  radius, density, border style, and style preset.
- Forms: Amblast's repeated quote form and the dedicated contact page form are
  separate `contactSection` blocks with their legacy field names.

## Known Gaps

Amblast's portfolio uses interactive before/after comparison widgets in the
legacy Astro site. The current canonical block set does not include a gallery or
comparison block, so the fixture preserves those assets and captions in a
`richText` block for data parity. A future renderer contract should add an
approved gallery/comparison variant before promising visual parity for that
section.

The legacy Amblast config and contact page disagree on address data:
`src/content/site.ts` contains `Heinsbergerweg 172, 6045 CK Roermond`, while the
legacy contact page body prints `Stationspark 189, 6042 AX Roermond`. The
renderer-compatible fixture keeps both signals so cutover review can reconcile
the business source of truth instead of silently dropping one.

The fixture captures form structure only. Legacy Web3Forms submission behavior,
the mailto fallback, animated card effects, before/after drag controls, shape
dividers, and exact imported CSS/JS interactions remain legacy-runtime behavior
until the generic renderer has approved equivalent blocks or integrations.

## Cutover Notes

The legacy `sites/ami-care` and `sites/amblast` builds remain the rollback path.
Renderer activation should be host-based: Traefik can keep routing the current
tenant domains to the legacy containers until an active published snapshot is
reviewed, then switch a domain or alias to the generic renderer. No tenant
source folder, tenant workflow, or tenant-specific image should be created for
new generated sites during this migration.
