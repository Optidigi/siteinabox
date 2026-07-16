# Generated-site block source catalog

SIAB generated sites consume validated structured data. AI may select only an
approved explicit variant and fill fields declared by that variant's typed slot
manifest; it never emits React, HTML, imports, classes, or source files.

The active provider is the MIT-licensed
[`akash3444/shadcn-ui-blocks`](https://github.com/akash3444/shadcn-ui-blocks)
catalog pinned to `46c2e50bb538c9bc7a8927979d38bae178ae4452`. Imports use
`registry-radix.json` only. The reproducible importer is
`scripts/import-shadcnui-blocks.mjs`.

Inventory:

- 542 upstream Radix registry items audited;
- 148 public-site variants across banner, blog, carousel-block, contact, CTA,
  FAQ, features, footer, hero, integrations, logo-cloud, navbar, pricing,
  stats, team, testimonials, and timeline;
- 8 `not-found` variants imported as system templates;
- 386 remaining items recorded with machine-readable exclusion reasons.

All IDs use the `shadcnui-blocks.*` namespace. The generated contracts manifest
is the sole catalog source for CMS choices, generation input, runtime block and
chrome registries, and system templates. Missing or unknown variants fail
validation and rendering. `hero-03` and `hero-08` declare embedded-navigation
composition metadata so standalone navbar chrome is suppressed.

Original upstream paths and hashes, the pinned registry capture, inventory,
exclusions, license, and provenance are stored in
`packages/site-renderer/src/providers/shadcnui-blocks`. Namespaced Radix Nova
compatibility primitives live in `packages/ui`; the CMS/shared primitives and
the single CMS `components.json` are untouched.

Every imported variant now has an explicit literal entry, typed slot adapter,
and machine-readable feature audit. Navbar and footer capabilities (flat versus
flyout navigation, item limits, mobile behavior, search, actions, columns,
links, and newsletter regions) are generated beside those slots. Contracts,
Payload validation, generator schema, CMS editor and all render surfaces consume
that same definition. Unsupported data is rejected with a field path; changing
a layout clears only settings for regions the new literal layout cannot show.

Tenant navigation supplies header and footer links. Flyout-capable `navbar-03`
accepts labelled groups with 1–6 described/iconed children; flat navbars reject
groups, and search-led `navbar-05` rejects a primary link list. Footer
composition consumes every configured item and augments semantic contact and
business sections from tenant contact, NAP, hours, service-area and social
settings. External-link intent survives storage, snapshots and safe runtime
attributes. `navbar-02`'s icon control is an accessible theme toggle backed by
the existing persisted color-mode runtime and localized from the site language.

The importer maintains one literal provider tree, used by production content
views and by the self-contained parity gate. It compares all 156 variants in isolated renderer
processes at fixed desktop/mobile viewports in light/dark mode. The structured
browser gate separately hydrates all 156 content, chrome and system variants
and checks demo-copy removal, basic accessibility, forms, mobile navigation,
flyouts, consent, and available accordion/carousel interactions.
Reference pixels allow only a 0.01% antialias tolerance. `contact-02` and
`features-03` have audited behavior adapters for real forms and CMS media;
navbar, footer and banner have settings adapters for tenant chrome. Those
adapters preserve the provider layout while replacing demo constants and are
covered as the complete explicit alternate production-render set.
The parity harness normalizes one pinned dependency defect: React 19.2.0 leaves
the Radix 1.4.3 default Select label empty, while SIAB's React patch renders the
authored selected item. SIAB keeps that accessible label instead of cloning the
blank output; layout and styling remain pixel-gated.

The forward Payload migrations have been applied through the complete migration
chain against an isolated fresh local database. Migration tests cover the audited
legacy JSON-draft shape. The migration maps null-variant privacy-page hero
and rich-text content to explicit provider variants without changing historical
migration files. A final forward-only cleanup migration removes the retired
rich-text, newsletter, and bento relational tables after their rows have been
copied into canonical semantic blocks. `banner-04` remains the only approved cookie-consent variant,
and known-tenant 404s select explicit imported not-found templates.
