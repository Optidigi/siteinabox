# @siteinabox/site-renderer

Shared rendering core for contract-driven SIAB pages.

This package holds React-compatible rendering logic used by CMS
preview/customizer surfaces and the future `apps/renderer` public runtime:

- block registry
- page rendering
- theme/token provider
- SEO helpers
- published snapshot rendering adapters

It renders validated contract data and must not become a source-code generator.
