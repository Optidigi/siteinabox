# SIAB Builder

Reserved deployable app for the future client-facing Builder workflow.

This app is intentionally not implemented in the first monorepo migration. It
will become its own container/image and Traefik-routed stack when Builder
implementation begins.

Expected responsibilities:

- intake form for normalized domain and project data,
- internal generator orchestration,
- authenticated preview at `https://preview.siteinabox.nl/<slug>/`,
- client approval,
- payment handoff through a future payment provider adapter,
- publish trigger and deployment metadata handoff.

Do not add product logic here during documentation-only architecture phases. The
canonical architecture decision is `docs/decisions/builder-platform.md`.
