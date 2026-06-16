# @siteinabox/contracts

Shared TypeScript contracts for data exchanged between SIAB apps, packages, and
generated sites.

## Ownership

- Put cross-package data shapes here when more than one app/package must agree
  on the same payload.
- Keep runtime rendering behavior out of this package. Site rendering belongs in
  `packages/site-template`; CMS editing and orchestration behavior belongs in
  the owning app/package.
- Prefer additive changes and explicit optional fields for generated-site
  compatibility.

## Current Contracts

- `rich-text`: structured rich text nodes used by CMS content and generated
  sites.
- `site`: generated-site page blocks, projections, media refs, navigation, and
  site settings.

## Checks

```bash
pnpm --dir packages/contracts typecheck
```
