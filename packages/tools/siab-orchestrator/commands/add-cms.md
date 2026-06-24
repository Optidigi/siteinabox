# Add CMS

Legacy workflow notice: this command converts an existing generated source
snapshot under `sites/<slug>`. It is retained for existing transition work and
historical reference. It is not the future product path for new self-serve
Builder sites.

Trigger this contract when the user asks for `/add-cms <slug>` or otherwise
asks to add Payload CMS to an existing legacy generated site under
`sites/<slug>`. If the user is asking about the new Builder architecture, route
them to `apps/builder` and `docs/decisions/builder-platform.md` instead.

The site slug is required. If the user did not provide it, stop and ask for the
slug before reading the workflow preflight.

Run this from the monorepo root or from `packages/tools/siab-orchestrator`;
resolve paths relative to the monorepo root.

1. Verify GitHub CLI readiness with `gh auth status`. If it fails, stop and ask
   the operator to authenticate before reading the workflow preflight.
2. Read `packages/tools/siab-orchestrator/workflows/cms/preflight.md`.
3. Summarize back to the user, in your own words:
   - what the workflow does end to end,
   - which phase agents are available and when each runs,
   - what this orchestrator never touches,
   - where per-tenant data lives and where the converted site reads it from.
4. Wait for explicit user confirmation.
5. After confirmation, read
   `packages/tools/siab-orchestrator/workflows/cms/prompt.md` and begin
   Phase 1 with the slug already known.

Do not skip the confirmation gate.
