# Editor / preview / public renderer parity

All surfaces use `packages/site-renderer` and validated explicit
`shadcnui-blocks.*` variants. Public pages use the static server entrypoint;
preview and editor use the generated active-variant client entrypoint. They
differ only in module loading, not markup, adapters, chrome, theme, or media.

Release gates:

- 148 public variants and eight not-found templates preserve upstream structural
  layout classes (committed fingerprints in
  `structural-fingerprints.json`, checked by `structural-fidelity.test.mjs`);
- the 542-item included/excluded partition and source hashes pass catalog
  integrity;
- semantic token coverage and typed adapter contracts pass unit tests;
- preview/editor load only variants present on the page;
- frames stay behind a skeleton until modules, load, fonts, commit, and two
  paint frames are ready;
- editor selection never replaces provider DOM;
- keyboard, focus, form, carousel/menu hydration, overflow, and WCAG checks
  pass in browser smoke tests;
- all 156 variants respond to approved color, font, shape, and mode presets;
- navigation-embedding heroes suppress duplicate header chrome;
- absent optional chrome renders nothing and invalid variants fail closed.

Run `pnpm --dir packages/site-renderer test` for structural fidelity, catalog
integrity, token coverage, and unit evidence. Browser smoke lives under
`apps/renderer` (`test:provider-browser`). Optional manual pixel comparison:
`pnpm --dir packages/site-renderer visual:provider-parity` (not a required CI
gate).
