# @siteinabox/contracts

Shared TypeScript contracts for data exchanged between SIAB apps, packages, and
tenant site snapshots.

## Ownership

- Put cross-package data shapes here when more than one app/package must agree
  on the same payload.
- Keep runtime rendering behavior out of this package. Current site rendering
  lives in `packages/site-template` and `sites/*` while the future platform
  architecture is reconsidered.
- Prefer additive changes and explicit optional fields for compatibility across
  CMS and current tenant snapshot consumers.

## Current Contracts

- `rich-text`: structured rich text nodes used by CMS content and tenant site
  snapshots.
- `site`: tenant site page blocks, projections, media refs, navigation, and
  site settings.

## Checks

```bash
pnpm --dir packages/contracts typecheck
```
