# Editor / preview / public renderer parity

All page surfaces use `packages/site-renderer` and the validated first-party
Sitegen block contracts. Public pages use the static server entrypoint; CMS
preview and editor use the same component implementation with edit slots and
selection attributes. They differ only in those explicitly scoped editor
adapters, not in block markup, media resolution, theme tokens, or content
ordering.

## First-party block contract

The eleven Sitegen families are `hero`, `services`, `about`, `process`, `work`,
`reviews`, `pricing`, `faq`, `cta`, `contact`, and `appointments`. Their semantic contracts
are code-owned. The current five hero designs belong to one `hero` family and
use local numbered variants—`hero-01`, `hero-02`, `hero-03`, `hero-04`, and
`hero-05`. Approved services and CTA designs are `services-01` through
`services-02`, `cta-01` through `cta-02`, and `appointments-01`; the remaining
seven families are currently pending until their own designs are reviewed.
Future section families and chrome families follow the same
family-plus-numbered-design convention (for example `services-01` and
`navbar-01`).
The CMS owns the explicit Payload block configuration and Sitegen catalog; the
shared renderer owns the exhaustive block switch and pending state. Appointment
schedule settings remain settings-owned and are not generated as page content;
the appointment section selects copy/presentation only and resolves availability
through the shared public/preview behavior.

Unknown block types and retired visual variant fields fail validation before
rendering. Renderers do not silently select a default for malformed persisted
data. While the reset is active, no variant default is assigned; a future
approved family may add its own explicit local default.

## Shared rendering boundary

`packages/site-renderer/src/blocks/index.tsx` is the single public block
dispatch. `SitePageRenderer` and `ClientSitePageRenderer` share the same page
implementation. The CMS editor adds `editSlots` and `data-siab-field` markers;
these do not change public layout or tenant CSS.

The generated-site shell is owned by settings rather than by `Page.blocks`.
The active numbered shell designs are `navbar-01` through `navbar-03`,
`footer-01`, and `consent-01`; navbar/footer are settings/catalog choices and
consent is a policy-controlled runtime surface rather than a Sitegen page
section. Announcement remains reserved settings data. Maintenance and not-found
use dedicated inline system output with editable copy, not numbered variants.
The enabled legal disclosure is a settings-owned structured document route, not
a page block. CMS/admin controls and governed legal/analytics infrastructure
remain outside the customer-site page-block catalog.

## Release evidence

- `packages/contracts` tests cover one valid example for every semantic block
  family plus rejected retired variant values.
- `apps/cms/tests/unit/sitegenCatalog.test.ts` checks the enabled hero,
  services, CTA, and appointment variants, deterministic media eligibility, and
  closed requirement tags.
- `packages/site-renderer/src/blocks/all-blocks.test.mjs` server-renders all
  five heroes, both services designs, both CTA designs, and `appointments-01`
  through the explicit switch, keeps the other families pending, and checks the
  image-alt fallback/editor-slot path.
- `packages/site-renderer/src/rich-text.test.mjs` covers the structured rich
  text DOM contract.
- CMS integration smoke and migration tests exercise the published projection
  and disposable PostgreSQL schema.

Visual review should use the existing renderer/browser infrastructure where
available. No external block library, copied source, or external-template
fingerprint is part of the release contract.
