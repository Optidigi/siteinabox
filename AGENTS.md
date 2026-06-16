# AGENTS.md

Repository operating rules for Codex and other coding agents in `siteinabox`.

## What This Repo Is

`siteinabox` is the SIAB monorepo shell. It keeps deployable apps isolated
while collecting shared generated-site contracts, themes, and orchestration
tools in one workspace.

Current moved surfaces:

- `apps/cms` - Payload CMS app, formerly `siab-payload`.
- `apps/site` - public Site in a Box site, formerly `site-siteinabox`.
- `apps/intake` - reserved future intake app package; no production service is
  deployed yet.
- `packages/site-template` - generated-site baseline, formerly
  `siab-site-template`.
- `packages/site-themes` - generated-site themes, formerly `siab-site-themes`.
- `packages/tools/siab-orchestrator` - combined orchestrator shell with
  separate `/new-site` and `/add-cms <slug>` workflows.
- `sites/ami-care` and `sites/amblast` - generated/client site source.

## Workflow Routing

- For CMS app work, read `apps/cms/AGENTS.md` and follow its rules.
- For generated-site template work, work in `packages/site-template`.
- For public site work, work in `apps/site`.
- For `/new-site`, use
  `packages/tools/siab-orchestrator/commands/new-site.md`.
- For `/add-cms <slug>`, use
  `packages/tools/siab-orchestrator/commands/add-cms.md`.
- For orchestrator package edits, also read
  `packages/tools/siab-orchestrator/AGENTS.md`.

Do not open an orchestrator workflow `prompt.md` before that workflow's
preflight/confirmation gate says to do so.

## Deploy Invariants

- Platform-owned app images are:
  - `ghcr.io/optidigi/siteinabox-cms`
  - `ghcr.io/optidigi/siteinabox-site`
- Tenant/generated site images remain stable unless the operator explicitly
  approves a deploy contract change:
  - `ghcr.io/optidigi/siteinabox-site-ami-care`
  - `ghcr.io/optidigi/siteinabox-site-amblast`
- VPS stack files are organized under
  `/srv/saas/infra/stacks/siteinabox/`.
- Keep Payload tenant data paths stable:
  `/srv/data/saas/siab-payload/tenants/<tenantId>`.
- Traefik is the production edge proxy. Public routing belongs in compose
  labels on the shared external `proxy` network.
- Do not reintroduce Nginx Proxy Manager registration helpers.

## Completion Gates

- If TypeScript or JavaScript changes under `apps/cms`, run
  `pnpm --dir apps/cms typecheck`.
- If generated-site app/template code changes, run the relevant build/check
  command for that package.
- For orchestrator script changes, run
  `npm --prefix packages/tools/siab-orchestrator/scripts test`.

Respect existing dirty work in imported app/package directories. Do not revert
unrelated changes.
