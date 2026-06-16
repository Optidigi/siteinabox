# Generated Site Snapshot Policy

`packages/site-template` is the canonical source of truth for generated-site
behavior, CMS renderers, generated-site contracts, and future site starts.
Tenant sites under `sites/*` are generated snapshots.

## Template Changes

- Make shared generated-site behavior changes in `packages/site-template`.
- Keep cross-package data shapes in `packages/contracts`.
- Do not treat an existing tenant site as the canonical source for future sites.
- Validate template changes with:

```bash
pnpm --dir packages/site-template --ignore-workspace exec astro check
pnpm --dir packages/site-template --ignore-workspace build
pnpm --dir packages/site-template --ignore-workspace test
```

## Existing Tenant Sites

Existing tenant sites should only be updated from the template when one of these
is true:

- The tenant is being CMS-ified.
- A template bug affects that tenant.
- A shared contract change requires the snapshot to stay compatible.
- The operator explicitly asks to refresh the snapshot.

When refreshing a tenant snapshot, keep tenant-specific content, visual
customization, environment contract, image name, and deploy contract stable
unless a deploy contract change is explicitly approved.

## Current Sites

- `sites/ami-care` has CMS-generated-site wiring and consumes
  `@siteinabox/contracts` through local compatibility re-exports.
- `sites/amblast` is a generated site snapshot that has not been CMS-ified yet.
  Do not add CMS contracts or renderers there until that work starts.

## Validation

For a refreshed tenant site, run its own check/build commands rather than
assuming the template build covers the snapshot. For example:

```bash
pnpm --dir sites/ami-care --ignore-workspace exec astro check
pnpm --dir sites/ami-care --ignore-workspace build
```
