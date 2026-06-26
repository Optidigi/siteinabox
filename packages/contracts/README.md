# @siteinabox/contracts

Shared TypeScript contracts for data exchanged between SIAB apps, packages, and
tenant site snapshots.

## Ownership

- Put cross-package data shapes here when more than one app/package must agree
  on the same payload.
- Keep runtime rendering behavior out of this package. Legacy/current snapshot
  rendering lives in `packages/site-template` and `sites/*`; future shared
  rendering belongs in `packages/site-renderer`.
- Future site generation contracts should describe validated tenant, site, page,
  theme, SEO, and published snapshot data. They must not describe generated
  source files, per-client folders, workflows, or containers.
- Prefer additive changes and explicit optional fields for compatibility across
  CMS, current tenant snapshot consumers, and future renderer consumers.

## Current Contracts

- `rich-text`: structured rich text nodes used by CMS content and tenant site
  snapshots.
- `site`: tenant site page blocks, projections, media refs, navigation, and
  site settings.
- `generation`: intake normalization, site generation specs, token theme specs,
  block manifests, published snapshots, and validation/apply result contracts.

## Validation

This package is currently type-first. Runtime validation is intentionally not
introduced here until the package adopts a schema dependency; strict validation
continues to live at the CMS and service boundaries that apply these contracts.

## Checks

```bash
pnpm --dir packages/contracts typecheck
```
