# Editor / preview / public renderer parity

All surfaces use `packages/site-renderer` and validated explicit
`shadcnui-blocks.*` variants. Public pages use the static server entrypoint;
preview and editor use the generated active-variant client entrypoint. They
differ only in module loading, not markup, adapters, chrome, theme, or media.

Release gates:

- 148 public variants and eight not-found templates match pinned upstream
  captures at fixed desktop/mobile viewports in light/dark modes;
- the 542-item included/excluded partition and source hashes pass;
- preview/editor load only variants present on the page;
- frames stay behind a skeleton until modules, load, fonts, commit, and two
  paint frames are ready;
- editor selection never replaces provider DOM;
- keyboard, focus, form, carousel/menu hydration, overflow, and WCAG checks
  pass;
- all 156 variants respond to approved color, font, shape, and mode presets;
- navigation-embedding heroes suppress duplicate header chrome;
- absent optional chrome renders nothing and invalid variants fail closed.

Run package tests plus `pnpm --dir packages/site-renderer
visual:provider-parity` with pinned-upstream and SIAB harness origins. Unit tests
alone are not visual-parity evidence.
