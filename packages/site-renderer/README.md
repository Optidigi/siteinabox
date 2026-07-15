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

`themeToCssVars` keeps tenant tokens root-scoped. Literal provider surfaces use
`data-provider-token-mode="reference"` for the exact upstream light/dark token
set, so custom overrides do not rewrite reference classes.

Run `pnpm test` for type, catalog-count, exclusion, slot, token, source-hash,
demo-copy, contact-form, and fail-closed checks. All imported variants have
explicit literal entries and typed adapters. `pnpm visual:provider-parity`
starts two isolated local renderer processes and compares all 156 variants at
fixed desktop/mobile light/dark viewports with a 0.001% antialias tolerance.
`pnpm --dir apps/renderer test:provider-browser` hydrates all 132 structured
content variants and checks browser errors, accessibility smoke rules, and
available interactions.
