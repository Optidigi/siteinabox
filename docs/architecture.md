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

The eleven Sitegen section families are `hero`, `services`, `about`, `process`,
`work`, `reviews`, `pricing`, `faq`, `cta`, `contact`, and `appointments`. Each family owns a
small semantic contract under `packages/contracts/src/blocks/`. The current
hero set is one semantic `hero` block family with five explicit code-owned
design IDs—`hero-01` through `hero-05`—so each reviewed design has a clear
asset requirement, Payload option, Sitegen catalog entry, and local renderer
case. Retired designs are not active in the contract, catalog, Payload
registry, or renderer.
The approved design variants currently cover `hero-01` through `hero-05`,
`services-01` through `services-02`, `cta-01` through `cta-02`, and
`appointments-01`. The other seven families remain semantic-only and render an
explicit pending marker until their own designs are approved. `RenderBlock` uses
an exhaustive block-type switch.
There is no provider abstraction, runtime block registry, component-tree
payload, or generated component source.

CMS preview/editor and public pages call the same `packages/site-renderer`
components. CMS may add edit slots and selection attributes around that output,
but it does not maintain a second block renderer or iframe geometry protocol.
Static sections remain server-rendered; only the smallest interactive boundary
(such as FAQ disclosure or an existing contact form) may use client behavior.

### Appointment runtime

Appointment scheduling is a tenant-owned runtime capability, not a page-block
or provider-specific renderer. `SiteSettings.appointments` stores a disabled-
by-default local schedule: IANA time zone, appointment duration and interval,
buffers, notice window, booking horizon, weekly windows, and date overrides.
The shared contract lives in `packages/contracts/src/appointments.ts`; the
Payload fields and the dedicated CMS schedule screen are projections of that
contract.

`apps/cms/src/lib/appointments` is the scheduling authority. It calculates
local-time slots, removes occupied confirmed bookings, rechecks the chosen slot
inside a database transaction, and relies on a PostgreSQL exclusion constraint
as the final concurrent-booking guard. The public renderer resolves the tenant
from the published host/snapshot and forwards validated availability and
booking requests to authenticated CMS routes. Visitor input never selects a
tenant, schedule, or source-code component.

This slice provides the local booking ledger and tenant agenda, plus the
authenticated renderer-to-CMS availability, booking, and management API. The
`appointments-01` page block is a semantic presentation of this capability, not
the schedule itself. Its contract carries only copy and `inline`/`dialog`
presentation; schedule settings, availability, and authoritative booking facts
remain in `SiteSettings.appointments` and the appointment runtime. Public output
uses the same small DOM controller as the CMS preview, with preview mode using
deterministic local weekday slots and never making a booking request. The public
controller uses the renderer API and CMS booking ledger when the schedule is
enabled.

Appointment notifications are queued through the CMS outbox and delivered by
the existing Cloudflare Email Sending adapter: the mail-scoped REST API is
preferred and Cloudflare SMTP is the fallback. Owner-authorised Google Calendar
and Microsoft Graph connections store encrypted OAuth tokens and synchronize
appointments through a versioned outbox, so cancellation or rescheduling
cannot leave an older provider operation authoritative. Calendar connections
can be disconnected and their credentials are cleared once pending provider
work has drained.

Appointment records use a tenant-configured retention window (90 days by
default, bounded to 30–730 days) measured from the appointment end. A daily
CMS task purges expired appointment rows and their notification/calendar
outboxes through foreign-key cascades; appointment-linked mail metadata follows
the same cascade so visitor addresses are not retained separately. OAuth
correlation state expires after ten minutes and is purged by the same task.
Tenant deletion cascades the appointment ledger and integration records.
Appointment records contain visitor contact data and remain tenant-scoped in
CMS. The tenant privacy disclosure and published privacy release must describe
this processing and any enabled calendar processors before activation.

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

Tenant branding is settings-owned media. The branding wordmark is the default
logo for navbar, footer, and consent chrome; a chrome-specific logo is used
only when explicitly configured in CMS. Sitegen settings normalization
materializes that default into nested chrome updates so partial Payload writes
cannot preserve a stale logo override. Tenant favicons use tenant-specific
filenames in published snapshots to avoid serving an old edge-cached asset
under a reused path. Historical media and snapshots remain retained for
rollback but are not active rendering dependencies.

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
