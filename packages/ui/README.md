# @siteinabox/ui

Shared UI primitives and low-level UI utilities for SIAB apps.

## Ownership

- This package owns shadcn-style primitives, token CSS, `cn`, CSP style helpers,
  and low-level reusable hooks.
- App-specific composites and layouts stay in the app that owns the workflow.
  CMS forms, editor canvas UI, navigation managers, dashboards, and future
  product workflow surfaces belong in the owning app when they only fit that
  app/workflow.
- Reusable composites can live in this package when they are modular,
  dependency-light, and useful to more than one app or workflow. Keep their
  data/domain behavior injectable through props, slots, or adapters instead of
  importing CMS internals.
- New app and CMS work must import shared primitives/components from this
  package, not from another app.
- Current tenant-site rendering logic lives in
  `packages/site-template` and `sites/*` while the future platform
  architecture is reconsidered.

## Imports

Use explicit component subpaths:

```ts
import { Button } from "@siteinabox/ui/components/button"
import { PageHeader } from "@siteinabox/ui/composites/page-header"
import { cn } from "@siteinabox/ui/lib/utils"
```

The root export is intentionally limited to low-level helpers and hooks. Avoid a
root component barrel so client component boundaries remain explicit.

Use `components/*` for shadcn-style primitives and `composites/*` for
app-neutral reusable compositions built from those primitives.

## Styles And Tokens

Apps consume shared tokens by importing the package stylesheet once from their
global app CSS:

```css
@import "@siteinabox/ui/styles/shadcn.css";
```

When an app has its own Tailwind v4 input CSS, add app-local `@source` entries
there and keep `packages/ui/src` included so shared component classes are
compiled. Do not copy token definitions into apps or create app-specific theme
forks without an approved design-system decision.

`PageHeader` and `EmptyState` are intentionally app-neutral composites. Keep
workflow-specific layout, data loading, routes, Payload integration, auth,
preview, approval, and payment behavior in the owning app.

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
