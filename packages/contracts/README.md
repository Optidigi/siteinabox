# @siteinabox/contracts

Shared TypeScript contracts for data exchanged between SIAB apps, packages, and
generated sites.

## Ownership

- Put cross-package data shapes here when more than one app/package must agree
  on the same payload.
- Keep runtime rendering behavior out of this package. Legacy site rendering
  currently lives in `packages/site-template` and `sites/*`; future shared
  preview/live/editor rendering belongs in `packages/site-runtime`.
- Prefer additive changes and explicit optional fields for compatibility across
  CMS, Builder, runtime, and legacy generated-site consumers.

## Current Contracts

- `rich-text`: structured rich text nodes used by CMS content and generated
  sites.
- `site`: generated-site page blocks, projections, media refs, navigation, and
  site settings.

## Checks

```bash
pnpm --dir packages/contracts typecheck
```
