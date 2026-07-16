# Canvas / renderer parity

CMS canvas, customer preview, and `apps/renderer` must use the same
`packages/site-renderer` provider registry. Generated blocks are selected only
by an explicit approved `shadcnui-blocks.*` variant; the CMS canvas shows a
fail-closed error surface when that variant is missing or unresolved.

The canonical manifest in `packages/contracts/src/generated` supplies the CMS
catalog, runtime registry, composition metadata, and slot exposure. Canvas edit
wrappers may add selection/edit affordances but must not replace provider
layout, classes, breakpoints, animations, or provider tokens.

Parity release gates:

- 148 public variants and eight not-found templates match the pinned upstream
  capture at desktop/mobile fixed viewports in light/dark modes;
- source hashes and the 542-item included/excluded partition pass;
- CMS canvas, CMS preview, and public renderer produce the same provider root,
  variant ID, slots, media dimensions, and chrome-composition behavior;
- keyboard, focus, form, carousel/menu hydration, and WCAG checks pass;
- production and parity import the same pinned literal tree; custom themes
  override only root-scoped color/font/radius variables, and exact reviewed
  fixed artwork is recorded in the provider token-exception manifest;
- all 156 variants respond to approved tenant color, font, shape, and
  light/dark presets in computed browser styles;
- `hero-03` and `hero-08` suppress separate navbar chrome;
- absent optional chrome emits no markup and missing variants never fall back.

Run package tests plus `pnpm --dir packages/site-renderer
visual:provider-parity` with pinned-upstream and SIAB harness origins. A green
unit suite alone is not visual-parity evidence.
