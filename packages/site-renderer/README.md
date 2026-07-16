# `@siteinabox/site-renderer`

Shared rendering core for CMS canvas/preview and `apps/renderer`.

Generated public sites use only the pinned `akash3444/shadcn-ui-blocks` Radix
catalog. The canonical generated manifest is in `packages/contracts`; runtime
block, chrome, and system-template registries derive from it. Every page block
must carry an approved `shadcnui-blocks.*` variant and unresolved variants fail
closed. Official Amicare variants remain tenant-exclusive compatibility paths.

Provider provenance, source hashes, the vendored MIT license, immutable upstream
sources, dependency inventory, and machine-readable exclusions live under
`src/providers/shadcnui-blocks`. Recreate them with:

```bash
node scripts/import-shadcnui-blocks.mjs
```

The importer always checks out commit
`46c2e50bb538c9bc7a8927979d38bae178ae4452` and reads
`registry-radix.json`. Provider compatibility primitives are namespaced under
`packages/ui/src/providers/shadcnui-blocks/radix-nova`; they never overwrite
shared/CMS primitives.

`themeToCssVars` is the single tenant-theme resolver. `ThemeTokenSpec` stores
only approved appearance, color, font, and shape preset IDs; the resolver emits
root-scoped semantic color/status/chart roles, deterministic self-hosted font
roles, and exact radius roles. Imported tenant views use those roles directly.
There is no arbitrary CSS map or per-block theme schema.

Literal comparison surfaces use `data-provider-token-mode="reference"` and a
generated reference copy with the exact pinned upstream classes/tokens. The
importer therefore keeps tenant adaptations separate from reference evidence.
Intentional fixed artwork, logo, mask, and on-media values are exhaustively
listed in `token-exceptions.json`; a fixed visual value outside that manifest
fails the catalog tests.

Run `pnpm test` for type, catalog-count, exclusion, slot, token, source-hash,
demo-copy, contact-form, and fail-closed checks. All imported variants have
explicit literal entries and typed adapters. `pnpm visual:provider-parity`
starts two isolated local renderer processes and compares all 156 variants at
fixed desktop/mobile light/dark viewports with a 0.01% antialias tolerance.
`pnpm --dir apps/renderer test:provider-browser` hydrates all 156 provider
variants at all four viewports, verifies two deliberately different tenant
themes through computed styles, and checks browser errors, overflow,
accessibility smoke rules, and available interactions.
