# Platform architecture

This document describes current ownership and data flow. Source contracts and
executable configuration remain authoritative for exact behavior.

## Applications and packages

- `apps/landing` owns the public marketing site.
- `apps/intake` owns the public intake flow at `/intake`.
- `apps/cms` is the Payload administration, tenant, content, commercial, and
  publishing authority.
- `apps/renderer` resolves tenants by request host and renders their active
  published snapshots.
- `packages/contracts` owns shared data shapes and the first-party semantic
  block contracts.
- `packages/ui` owns shared primitives, tokens, and application-neutral UI.
- `packages/site-renderer` owns rendering shared by CMS preview/editor surfaces
  and the public renderer.
- `packages/legal-content` owns versioned legal text and release metadata.
- `packages/contracts/src/product.ts` owns shared public product facts used by
  the landing and intake applications, including approved pricing.

## Product flow

1. Intake creates validated CMS-owned intake and tenant data.
2. CMS workflows edit site, page, theme, SEO, domain, commercial, and publishing
   data.
3. Publishing creates an immutable validated snapshot and selects the tenant's
   active snapshot.
4. The renderer resolves the request host, loads that snapshot, and renders it
   through `packages/site-renderer`.
5. Forms, analytics, legal state, payments, domains, DNS, and mail stay behind
   their approved application or provider boundaries.

New sites are data and snapshots. They never create tenant-specific source
trees, GitHub workflows, application images, or arbitrary executable AI output.

## Rendering

Contracts under `packages/contracts` define the accepted site and block shapes.
Each Sitegen section owns a semantic Zod contract; the approved hero family
also owns numbered design variants. The Sitegen catalog in
`apps/cms/src/lib/sitegen` describes section purpose and deterministic input
eligibility; it does not own React components or Payload field definitions.

CMS preview and public output share `packages/site-renderer`. CMS may add editor
chrome around that output but must not add another block renderer or mutate an
iframe's DOM/geometry to simulate parity. Missing or unknown variants fail
closed.

Ami Care uses the same validated first-party block, theme, media, preview, and
published-snapshot path as every generated tenant. Tenant identity
affects content and routing only; it never selects a source-code renderer.

Public renderer routing is TLD-neutral but not open-ended. A canonical domain
is eligible only when its managed-domain record has active entitlement plus
verified authoritative DNS, HTTPS, and edge state. A tenant that predates
commerce records is eligible only through its system-owned, versioned
`preCommerceRoutingAdoption` database evidence and only while domain
verification, tenant state, active snapshot ownership, and its unique explicit
`www` alias remain valid. This adoption grants routing only—never payment,
registrant, registrar, renewal, transfer, DNS-write, or provider authority.
The presence of any managed-domain row for that canonical hostname permanently
switches it to the stricter lifecycle authority. Every other alias requires its
own active managed-domain lifecycle. The CMS snapshot endpoint returns that
eligible canonical domain and its explicit active alias allowlist; the renderer
validates the routing envelope before serving tenant content. Apex and `www`
are independent entries—`www` is not inferred.
Production origin requests arrive only through the outbound-only Cloudflare
Tunnel. The renderer has no published host port and is not attached to the
public Traefik network. `SIAB_RENDERER_ORIGIN_TRUST_MODE=cloudflare_tunnel`
selects this topology explicitly and fails closed when combined with the legacy
edge-secret mode. The original `Host` is required; `X-Forwarded-Proto` must be
HTTPS, and when `X-Forwarded-Host` is present it must match. Health checks inside
the private container network are the only unauthenticated exception.
Unknown or invalid hosts fail with a tenant-neutral 404.

### First-party Sitegen semantic blocks

The ten Sitegen section families are `hero`, `services`, `about`, `process`,
`work`, `reviews`, `pricing`, `faq`, `cta`, and `contact`. Each family owns a
small semantic contract under `packages/contracts/src/blocks/`. The current
hero set is one semantic `hero` block family with five explicit code-owned
design IDs—`hero-01` through `hero-05`—so each reviewed design has a clear
asset requirement, Payload option, Sitegen catalog entry, and local renderer
case. Retired designs are not active in the contract, catalog, Payload
registry, or renderer.
The approved design variants currently cover `hero-01` through `hero-05`,
`services-01` through `services-02`, and `cta-01` through `cta-02`. The other
seven families remain semantic-only and render an explicit pending marker until
their own designs are approved. `RenderBlock` uses an exhaustive block-type
switch.
There is no provider abstraction, runtime block registry, component-tree
payload, or generated component source.

CMS preview/editor and public pages call the same `packages/site-renderer`
components. CMS may add edit slots and selection attributes around that output,
but it does not maintain a second block renderer or iframe geometry protocol.
Static sections remain server-rendered; only the smallest interactive boundary
(such as FAQ disclosure or an existing contact form) may use client behavior.

The generated-site shell is a separate settings-owned concern, not a
`Page.blocks` choice. Active numbered chrome currently includes
`navbar-01` through `navbar-03`, `footer-01`, and `consent-01`; all use the
shared renderer and their own local switches. Navbar and footer choices are
settings/catalog concerns, while consent is a policy-controlled runtime
surface rather than a Sitegen page-section choice. Announcement remains
settings-owned data until a numbered announcement design exists. Maintenance
and not-found use dedicated inline system output with editable settings copy,
not numbered variants. The enabled legal disclosure is also settings-owned:
its structured `RtRoot` body is rendered at its stable document route and is
never represented as a page block. CMS/admin controls and governed
legal/analytics infrastructure stay outside the customer page-section
catalog.

## Operational ownership

- Payload schemas and migrations own persisted CMS shape and upgrades.
- The root lockfile and workspace manifests own dependency resolution.
- Root/package scripts and CI own verification.
- Image workflows own release triggers; compose files own container wiring and
  the renderer's private Tunnel connector.
- `docs/runbooks/` owns procedures; `docs/contracts/` owns durable behavioral
  boundaries; `docs/findings.md` owns unresolved repository findings.
- Shared public product facts belong in `packages/contracts/src/product.ts`;
  application pages and public context files are consumers of those facts.
- Production and provider mutations remain operator-controlled.
