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
