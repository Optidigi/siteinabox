# @siteinabox/ui

Shared UI primitives and low-level UI utilities for SIAB apps.

## Ownership

- This package owns shadcn-style primitives, token CSS, `cn`, CSP style helpers,
  and low-level reusable hooks.
- App-specific composites and layouts stay in the app that owns the workflow.
  CMS forms, editor canvas UI, navigation managers, dashboards, and site
  rendering behavior belong in `apps/cms` when they only fit that app/workflow.
- Reusable composites can live in this package when they are modular,
  dependency-light, and useful to more than one app or workflow. Keep their
  data/domain behavior injectable through props, slots, or adapters instead of
  importing CMS internals.
- Site generation and rendering logic stays in `packages/site-template`.
  Tenant sites are generated snapshots of that template, not the canonical UI
  source.

## Imports

Use explicit component subpaths:

```ts
import { Button } from "@siteinabox/ui/components/button"
import { cn } from "@siteinabox/ui/lib/utils"
```

The root export is intentionally limited to low-level helpers and hooks. Avoid a
root component barrel so client component boundaries remain explicit.

## Compatibility Shims

`apps/cms/src/components/ui/*`, `apps/cms/src/lib/utils.ts`,
`apps/cms/src/components/csp-*.tsx`, and `apps/cms/src/hooks/use-mobile.ts`
re-export this package for compatibility with local shadcn tooling and older app
paths. Edit package source files here, not those shims.

## Checks

```bash
pnpm --dir packages/ui typecheck
pnpm --dir apps/cms lint:ui-boundary
pnpm --dir apps/cms lint:ui-composition
pnpm --dir apps/cms lint:no-css
```
