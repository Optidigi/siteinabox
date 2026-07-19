# Platform architecture

This document describes current ownership and data flow. Source contracts and
executable configuration remain authoritative for exact behavior.

## Applications and packages

- `apps/landing` owns the public marketing site.
- `apps/intake` owns the public intake flow at `/intake`.
- `apps/cms` is the Payload administration, tenant, content, commercial, and
  publishing authority.
- `apps/renderer` resolves tenants by request host and renders their active
  published snapshots.
- `packages/contracts` owns shared data shapes and the block catalog contract.
- `packages/ui` owns shared primitives, tokens, and application-neutral UI.
- `packages/site-renderer` owns rendering shared by CMS preview/editor surfaces
  and the public renderer.
- `packages/legal-content` owns versioned legal text and release metadata.

## Product flow

1. Intake creates validated CMS-owned intake and tenant data.
2. CMS workflows edit site, page, theme, SEO, domain, commercial, and publishing
   data.
3. Publishing creates an immutable validated snapshot and selects the tenant's
   active snapshot.
4. The renderer resolves the request host, loads that snapshot, and renders it
   through `packages/site-renderer`.
5. Forms, analytics, legal state, payments, domains, DNS, and mail stay behind
   their approved application or provider boundaries.

New sites are data and snapshots. They never create tenant-specific source
trees, GitHub workflows, application images, or arbitrary executable AI output.

## Rendering

Contracts under `packages/contracts` define the accepted site and block shapes.
The reviewed block catalog and generated artifacts define approved variants and
provider provenance. Prose does not maintain a copied variant count.

CMS preview and public output share `packages/site-renderer`. CMS may add editor
chrome around that output but must not add another block renderer or mutate an
iframe's DOM/geometry to simulate parity. Missing or unknown variants fail
closed.

Ami Care uses the same validated provider-block, chrome, theme, media, preview,
and published-snapshot path as every generated tenant. Tenant identity affects
content and routing only; it never selects a source-code renderer.

### Typed pilot variants

A small set of shadcnui-blocks variants are migrating from pinned upstream
literals with `Provider*` runtime slots to owned typed components under
`packages/site-renderer/src/providers/shadcnui-blocks/variants/<name>/`.
Shared helpers for the migrated pilots live in
`packages/site-renderer/src/providers/shadcnui-blocks/typed/` (rich-text
preview fixtures, element paths, and edit-slot renderers). The compile-time
registry in `typed/registry.ts` lists exactly the migrated pilots
(`cta-01` … `cta-07`, `logo-cloud-01` … `logo-cloud-15`, `faq-01` … `faq-14`,
`features-01` … `features-18`, `hero-01` … `hero-08`) and ties each variant ID to its
canonical block type, direct bindings, and view module.

Legacy behavior adapters (`contact-02`) still use audited `Provider*`
views and are tracked beside the typed registry; they are not forced into
the shared typed helper surface until a pilot migration needs them.
All other block variants continue to render through pinned literals and
`block-views.generated.tsx` dispatch.

Re-import and scaffold workflows live under `scripts/shadcnui-blocks/`:

- `node scripts/import-shadcnui-blocks.mjs` acquires the pinned upstream
  commit, applies generic literal normalization, runs legacy binding compilation
  only for non-`bindings.direct` variants, and refreshes `inventory.json`.
- Direct-binding and typed-pilot variants keep owned sources on re-import; the
  importer skips `compileBlockBindings` for every `bindings.direct` entry.
- `node scripts/import-shadcnui-blocks.mjs --scaffold=<upstream-name>
  --upstream-literal=@path/to/literal.tsx` creates a typed adaptation scaffold
  (normalized `upstream-literal.tsx`, stub component, view mapper, fixture stub).
  It refuses to overwrite typed pilots or direct-bound variants unless `--force`
  is passed.
- Variant-specific literal surgery is centralized in
  `scripts/shadcnui-blocks/variant-special-cases.mjs`; generic normalization
  in `adapt-literal.mjs` must remain variant-agnostic.

## Operational ownership

- Payload schemas and migrations own persisted CMS shape and upgrades.
- The root lockfile and workspace manifests own dependency resolution.
- Root/package scripts and CI own verification.
- Image workflows own release triggers; compose files own container wiring and
  Traefik routing.
- `docs/runbooks/` owns procedures; `docs/contracts/` owns durable behavioral
  boundaries; `docs/findings.md` owns unresolved repository findings.
- Production and provider mutations remain operator-controlled.
