# Builder Platform Architecture

Status: accepted direction for future implementation.

This decision defines the intended SIAB product architecture for future
sessions started from the monorepo root. It is documentation only; it does not
authorize Builder product implementation by itself.

## App Boundaries

- `apps/site` is the public marketing site for Site in a Box.
- `apps/builder` is the future client-facing app for intake, generator
  orchestration, authenticated preview, approval, payment handoff, and publish
  trigger.
- `apps/cms` remains the Payload CMS app: admin, editor, tenant management, and
  content control plane.
- `apps/runtime` is the future public live tenant renderer. It is intentionally
  not implemented yet.
- `packages/ui` owns shared UI primitives/components used by CMS and Builder.
  Apps must not import components from each other.
- `packages/contracts` owns shared data contracts used across Builder, CMS,
  runtime, and transition tooling.
- `packages/site-runtime` is the future shared renderer for preview/live/editor
  consistency. It is not the same thing as the legacy generated-site template.

## V1 Flow

1. A client enters project and domain information in `apps/builder`.
2. Builder normalizes the submitted domain into domain data.
3. Builder derives the slug, preview path, live hostname, and deployment
   metadata from the normalized domain data.
4. Builder runs internal generator logic that produces validated structured
   site data matching `packages/contracts`.
5. Builder serves authenticated preview at
   `https://preview.siteinabox.nl/<slug>/`.
6. The client approves the preview in Builder.
7. Builder hands off to a future payment provider adapter.
8. After payment/provider confirmation, Builder triggers publish metadata and
   deployment handoff.
9. CMS remains the authority for tenant/content control after creation.
10. The future runtime serves the public live tenant site from tenant data and
   shared renderer contracts.

DNS and domain pointing remain manual outside automation. The submitted domain
still drives normalized domain data and derived metadata, but the platform does
not automatically change external DNS in this architecture decision.

## Preview, Domain, And Slug Model

- Preview URL shape: `https://preview.siteinabox.nl/<slug>/`.
- The preview path is owned by Builder.
- The live hostname is derived from normalized domain data.
- Slugs are derived from normalized domain data and must be stable once a tenant
  is created unless a future migration explicitly handles rename semantics.
- Deployment metadata should reference normalized domain data, slug, preview
  path, and live hostname rather than raw form input.

## Payment Provider Neutrality

The PSP is undecided. Future implementation must use a payment provider adapter
boundary and remain neutral between providers such as Stripe or Mollie until a
specific provider decision is made.

Docs and contracts should say "payment provider adapter" unless they are
describing a deliberately provider-specific integration after that decision.

## AI Boundaries

AI may assist the internal generator, but it must output validated structured
data. It must not output arbitrary React components, app source code,
executable code, or unchecked templates for production use.

Generator outputs must be validated against explicit contracts before preview,
approval, publish, or CMS handoff.

## Shared UI Expectations

Shared primitives and reusable components belong in `packages/ui`. Builder and
CMS may consume those package exports, but neither app may import app-local
components from the other app.

Workflow-specific composites stay in the owning app until there is clear reuse
across apps and the behavior can be expressed through props, slots, or adapters
without importing app internals.

## Future Runtime Expectations

`apps/runtime` will be added later as the public live tenant renderer.
`packages/site-runtime` should become the shared rendering library used by:

- Builder authenticated preview,
- public live runtime,
- CMS editor/canvas consistency.

The goal is one structured-data rendering contract across preview, live, and
editor surfaces, not source-code generation per tenant.

## Legacy Paths

The following paths are legacy/transition mechanisms:

- `packages/tools/siab-orchestrator` and its `/new-site` and `/add-cms`
  workflows,
- `packages/site-template`,
- `packages/site-themes`,
- `sites/*` generated source folders.

They remain available for existing tenants and migration/reference work. They
are not the target architecture for new self-serve Builder sites.

Do not create new Builder product sites by copying `packages/site-template` into
`sites/<slug>`. Do not treat `sites/*` as the future tenant persistence model.

## Non-Goals For This Phase

- No Builder UI implementation.
- No AI integration.
- No payment integration.
- No Payload collection changes.
- No runtime implementation.
- No per-client source generation.
- No Tailwind/shadcn block migration.
