# @siteinabox/site-renderer

Shared rendering core for contract-driven SIAB pages.

This package holds React-compatible rendering logic used by CMS
preview/customizer surfaces and the `apps/renderer` public runtime:

- block registry
- page rendering
- theme/token provider
- SEO helpers
- published snapshot rendering adapters

It renders validated contract data and must not become a source-code generator.

Provider-backed Tailwind Plus blocks live under `src/source-blocks`. Active
provider blocks preserve provider-owned DOM/classes and expose only structured
CMS slots. Their roots are marked with `data-provider-block`,
`data-provider-variant`, and `data-source-backed-block`; generic `.cms-block`
CSS must exclude those roots. Unknown provider variants fail closed instead of
falling back to generic SiaB block renderers.

Provider tests are split by boundary:

- `pnpm --dir packages/site-renderer test` runs package-local registry, slot,
  inactive-slot, contact/newsletter runtime-boundary, testimonial token-marker,
  and theme bridge tests.
- CMS tests cover generation/import, CMS schema, save/publish, and snapshot
  integration against the same provider manifests.
- `pnpm provider:visual-parity` is the browser gate for source-visible pixel
  parity and dark/tokenized smoke checks.

Generation data may select only approved block IDs plus typed slots. It must
not provide HTML, React, CSS, Tailwind class strings, imports, layout rules, or
per-block style tokens. Runtime-only form metadata is not treated as provider
source UI, and dark-mode adaptation stays in explicit token bridge rules.
