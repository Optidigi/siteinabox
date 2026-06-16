# siab-platform

Monorepo shell for the SIAB platform.

## Layout

```txt
apps/
  cms/              # Payload CMS app, formerly siab-payload
  site/             # public siteinabox.nl site, formerly site-siteinabox
  intake/           # reserved future intake app

packages/
  site-template/    # generated-site baseline, formerly siab-site-template
  site-themes/      # generated-site themes, formerly siab-site-themes
  tools/
    siab-orchestrator/
      commands/     # /new-site and /add-cms command contracts
      workflows/    # separate sitegen and CMS conversion workflows
      scripts/      # CMS conversion helpers
      runbooks/

sites/
  # intended home for generated/client sites once migrated
```

## Deployment Contract

The monorepo publishes new platform-owned images:

- `apps/cms` publishes `ghcr.io/optidigi/siab-platform-cms:latest`.
- `apps/site` publishes `ghcr.io/optidigi/siab-platform-site:latest`.
- Generated/client sites are intended to move under `sites/`, while their
  existing production image names and VPS stack entries remain stable until
  each site is migrated deliberately.
- Existing VPS stack paths and tenant data paths are not moved in this step.
- Traefik remains the edge proxy; routing stays compose-label based.

## Useful Checks

```bash
pnpm cms:typecheck
pnpm cms:test
pnpm site:build
pnpm template:build
pnpm orchestrator:test
```
