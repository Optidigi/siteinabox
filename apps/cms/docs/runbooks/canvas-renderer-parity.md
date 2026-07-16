# Canvas / renderer parity

CMS canvas, customer preview, and `apps/renderer` must use the same
`packages/site-renderer` provider registry. Generated blocks are selected only
by an explicit approved `shadcnui-blocks.*` variant; the CMS canvas shows a
fail-closed error surface when that variant is missing or unresolved.

The canonical manifest in `packages/contracts/src/generated` supplies the CMS
catalog, runtime registry, composition metadata, and slot exposure. Canvas edit
wrappers may add selection/edit affordances but must not replace provider
layout, classes, breakpoints, animations, or reference tokens.

Parity release gates:

- 148 public variants and eight not-found templates match the pinned upstream
  capture at desktop/mobile fixed viewports in light/dark modes;
- source hashes and the 542-item included/excluded partition pass;
- CMS canvas, CMS preview, and public renderer produce the same provider root,
  variant ID, slots, media dimensions, and chrome-composition behavior;
- keyboard, focus, form, carousel/menu hydration, and WCAG checks pass;
- every tenant view uses semantic color/font/radius roles or an exact reviewed
  entry in the provider token-exception manifest, while the generated reference
  copy retains the pinned upstream classes for independent pixel evidence;
- all 156 variants respond to approved tenant color, font, shape, and
  light/dark presets in computed browser styles;
- `hero-03` and `hero-08` suppress separate navbar chrome;
- absent optional chrome emits no markup and missing variants never fall back.

Run package tests plus `pnpm --dir packages/site-renderer
visual:provider-parity` with pinned-upstream and SIAB harness origins. A green
unit suite alone is not visual-parity evidence.
