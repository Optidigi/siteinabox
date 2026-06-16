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
  ami-care/         # generated CMS-backed tenant site, formerly site-amicare-zorg
  amblast/          # generated/client site, formerly site-amblast
```

## Deployment Contract

The monorepo publishes new platform-owned images:

- `apps/cms` publishes `ghcr.io/optidigi/siab-platform-cms:latest`.
- `apps/site` publishes `ghcr.io/optidigi/siab-platform-site:latest`.
- Generated/client site source lives under `sites/`. Current tenant site
  deployments publish monorepo-owned images:
  `ghcr.io/optidigi/siab-platform-site-ami-care:latest` and
  `ghcr.io/optidigi/siab-platform-site-amblast:latest`.
- VPS stack files live under `/srv/saas/infra/stacks/siab-platform/`, while
  tenant data paths stay unchanged under `/srv/data/saas/siab-payload/`.
- Traefik remains the edge proxy; routing stays compose-label based.
- `apps/intake` is present as a reserved app package. No intake service/image is
  deployed yet.

## Useful Checks

```bash
pnpm cms:typecheck
pnpm cms:test
pnpm site:build
pnpm tenant:amicare:build
pnpm tenant:amblast:build
pnpm template:build
pnpm orchestrator:test
```
