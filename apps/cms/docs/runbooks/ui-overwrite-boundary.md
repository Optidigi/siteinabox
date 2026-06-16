# UI overwrite boundary

This repo uses upstream shadcn as the primitive baseline, but it does not treat
every local primitive as blindly overwriteable. Shared primitive source now
lives in `packages/ui`; the CMS app keeps compatibility re-export shims.

## Paths

- `packages/ui/src/components/` owns shadcn primitive source.
- `packages/ui/src/styles/shadcn.css` owns the shared token/base CSS.
- `packages/ui/src/lib/` owns `cn` and CSP-safe runtime style helpers used by
  primitives and CMS chrome.
- `src/components/ui/` is upstream-name-only compatibility shims. It may contain
  shadcn primitive filenames such as `button.tsx`, `dialog.tsx`, `input.tsx`,
  and `sidebar.tsx`, but those files should re-export from `@siteinabox/ui`.
- App/editor composites live outside `src/components/ui/`:
  - `src/components/editor/`
  - `src/components/editor/canvas/`
  - `src/components/editor/richText/toolbar/`
  - `src/components/editor/theme/`
  - `src/components/save-ui/`
  - `src/components/common/`
- `src/styles/shadcn.css` imports `@siteinabox/ui/styles/shadcn.css`.
- `src/styles/siab.css` is protected SIAB app/editor/canvas CSS.

`pnpm lint:ui-boundary` enforces the app path split. `pnpm lint:ui-composition`
adds drift checks for composition style: direct Radix imports stay inside
reviewed primitives, inline style objects are blocked, and new files with
native `<button>` elements fail unless they are deliberately added to the
reviewed exception list in `scripts/check-ui-composition.mjs`.

## Primitive overwrite policy

Use `pnpm dlx shadcn@latest add @shadcn/<item> --diff` before accepting an
overwrite. Apply accepted primitive changes in `packages/ui/src/components/`
and keep the CMS shim intact. Do not bulk-overwrite primitives.

Last reviewed against `@shadcn` on 2026-06-15:

| Primitive | Decision | Reason |
| --- | --- | --- |
| `button` | Keep local fork | Upstream removes `type="button"` default, pointer cursor, mobile 44px/touch sizes, extra sizes, and local hover contrast. |
| `chart` | Keep local fork | Upstream reintroduces inline style objects for swatches/indicators and removes CSP nonce/style-rule sanitization. It also pulls a transitive `card` radius change. |
| `dialog` | Keep local fork | Upstream removes localized labels, mobile coarse-pointer autofocus guard, max-height/scroll containment, and local footer/content behavior. |
| `sheet` | Keep local fork | Upstream removes localized close label and mobile coarse-pointer autofocus guard. |
| `sidebar` | Keep local fork | Upstream pulls transitive `button`, `sheet`, and `input` changes and risks removing sidebar-local CSP/i18n/mobile behavior. |
| `badge` | Keep local fork | Upstream removes SIAB `success` and `warning` variants. |
| `input` | Keep local fork | Upstream removes mobile 44px tap-target floor. |
| `select` | Keep local fork | Upstream removes mobile default-trigger 44px tap-target floor. |
| `tabs` | Keep local fork | Upstream removes mobile horizontal tablist height that preserves 44px triggers. |
| `breadcrumb` | Keep local fork | Upstream removes localized aria/screen-reader labels. |
| `pagination` | Keep local fork | Upstream removes localized aria/screen-reader labels and also pulls transitive `button` changes. |
| `command` | Keep local fork | Upstream removes localized command dialog defaults and pulls transitive `dialog` changes. |
| `avatar` | Upstream clean | `shadcn add @shadcn/avatar --diff` reports no changes. |
| `textarea` | Upstream clean | `shadcn add @shadcn/textarea --diff` reports no changes. |

Keep these as reviewed local forks unless the listed behavior is intentionally
reimplemented elsewhere:

- `button`: default `type="button"`, pointer cursor, mobile/touch sizes, local
  hover contrast, extra sizes.
- `chart`: CSP nonce/style-rule handling and chart color safety.
- `dialog`: localized labels, scroll/max-height behavior, mobile autofocus
  guard, local footer/content behavior.
- `sheet`: localized close label and mobile autofocus guard.
- `sidebar`: CSP-safe style handling, localized labels, mobile/touch behavior,
  active-state and layout tweaks.
- `badge`: SIAB semantic variants such as `success` and `warning`.
- `input`, `select`, `tabs`: local mobile/touch density policy.
- `breadcrumb`, `pagination`, `command`: localized aria/screen-reader defaults.

Other primitive overwrites are lower risk, but still review the diff and run the
frontend gates.

## Gates

After UI boundary or primitive work, run:

```bash
pnpm lint:ui-boundary
pnpm lint:ui-composition
pnpm lint:no-css
pnpm check:responsive
pnpm typecheck
```

Run focused unit or E2E coverage for the touched surface.
