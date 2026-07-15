# Data-driven site generation

The CMS remains tenant/content authority. Generation produces a validated
`SiteGenerationSpec`; publishing produces a validated tenant snapshot;
`apps/renderer` renders that snapshot through `packages/site-renderer`.
Per-tenant source trees, executable AI output, and tenant images are forbidden.

Every generated block requires an explicit `shadcnui-blocks.*` variant from the
canonical generated manifest. Each variant exposes required, optional,
inactive, and repeated structured slots. The CMS generator prompt, editor
catalog, canvas/preview renderer, and public runtime derive from that one
manifest. Unknown or missing variants fail closed.

The provider capture is reproducible and pinned: `akash3444/shadcn-ui-blocks`
commit `46c2e50bb538c9bc7a8927979d38bae178ae4452`, Radix registry only. Provider
DOM sources and provenance are vendored in `packages/site-renderer`; namespaced
compatibility primitives live in `packages/ui`.

Chrome is optional structured settings. Absent chrome renders nothing. Hero
composition metadata suppresses duplicate navigation. Cookie consent uses the
approved `banner-04` clone and versioned analytics receipt. Privacy content and
404s use explicit provider variants/templates rather than native fallbacks.

Forward Payload migrations map persisted variants, snapshot JSON and structured
chrome capabilities. The complete chain is rehearsed against a disposable local
PostgreSQL database; deployment uses Payload's normal transactional migration
path. Historical migrations remain immutable.
