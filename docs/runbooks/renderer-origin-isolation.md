# Renderer origin isolation

## Existing-domain rollout gate

Deploy the exact reviewed CMS image in `shadow`, then run its bundled
`/app/dist-runtime/check-commerce-edge-inventory.bundled.mjs` command against
the target database using the one-off command in
[Commerce release](commerce-release.md). It is read-only and fails when an
active tenant does not have exactly one active managed-domain row with a
Cloudflare zone. Do not advance beyond `shadow` while it fails.

After the additive migration and both application/Tunnel services are running,
use the explicitly approved, bundled
`reconcile-commerce-edge-routing.bundled.mjs` command to establish exact
routes. Repeat it while certificate state is legitimately pending, run the
black-box origin/host probes, and only then set the origin-isolation evidence
flag and run the bundled read-only production-readiness gate. If reconciliation
cannot complete, restore the previous application images; the additive
migration is compatible and must remain in place while the evidence issue is
corrected.

Status: code-controlled topology is implemented; production Cloudflare and
network evidence remains approval-gated. Do not set
`COMMERCE_ORIGIN_ISOLATION_VERIFIED=1` from repository tests alone.

## Security contract

Cloudflare terminates customer TLS. Two dedicated remotely managed Cloudflare
Tunnels make outbound connections:

- `siteinabox-renderer` forwards exact approved apex and `www` hosts to
  `http://siteinabox-renderer:4321` on `renderer-origin`.
- `siteinabox-cms` forwards exact approved `admin.<domain>` hosts to
  `http://siteinabox-cms:3000` on `cms-origin`.

Both remote ingress configurations end with `http_status:404`. Neither uses a
wildcard, `httpHostHeader`, public origin port, or customer-host Traefik
certificate router.

`SIAB_RENDERER_ORIGIN_TRUST_MODE=cloudflare_tunnel` makes the private Tunnel
the explicit origin boundary. The renderer has no published listener or public
proxy attachment, and production startup fails closed if this mode is mixed
with the legacy edge-secret configuration. This avoids coupling every customer
zone to a shared header secret and its coordinated rotation.

The application then resolves the canonicalized `Host` only through active CMS
domain/snapshot data. Apex and `www` are separate allowlist entries. Unknown,
inactive, or cross-tenant hosts receive a neutral `404`.

Primary Cloudflare contracts:

- [Cloudflare Tunnel uses outbound-only connections](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/)
- [Route DNS records to a tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/dns/)
- [Run a tunnel from a token file](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/run-parameters/)

## Approval-gated production setup

The following Cloudflare, DNS, secret-store, firewall, and deployment mutations
require an approved production change. Record redacted object names, timestamps,
configuration hashes, and probe results in the release dossier; never record
tokens or the origin-secret value.

1. Inventory current tunnels, renderer/CMS listeners, DNS records, zone rulesets,
   Universal SSL state, and firewall exposure read-only. Confirm there is no
   existing suitable Siteinabox renderer tunnel before creating one. Do not
   repurpose an unrelated tunnel.
2. Create or reuse exactly two remotely managed tunnels named
   `siteinabox-renderer` and `siteinabox-cms`. Persist their UUIDs as
   `CLOUDFLARE_RENDERER_TUNNEL_ID` and `CLOUDFLARE_CMS_TUNNEL_ID`. Do not
   configure an origin `Host` override. The CMS reconciliation job owns the
   complete deterministic ingress arrays.
3. Store the runtime tokens in
   `/srv/saas/secrets/siteinabox-renderer-tunnel-token` and
   `/srv/saas/secrets/siteinabox-cms-tunnel-token`, and a separately
   generated renderer/CMS bearer value in
   `/srv/saas/secrets/siteinabox-renderer-api-token`. Files must be owned by
   numeric UID/GID `1000:1000` and mode `0600`, matching both explicitly
   unprivileged compose services. If the host deployment account uses another
   UID, install the files with `1000:1000` ownership rather than weakening
   their mode.
4. Give the CMS automation token Account `Cloudflare Tunnel: Edit`, Account
   `DNS Settings: Read`, Zone
   `Zone: Read/Edit`, Zone `DNS: Read/Edit`, and Zone
   `SSL and Certificates: Read`
   for the Siteinabox account and managed zones. Account `DNS Settings: Read`
   is used only when Cloudflare reports a zone-level DNS record quota as
   `null`; the readiness check then verifies the account-level quota instead.
   The runtime Tunnel tokens are
   separate credentials. The exclusive `reconcile-commerce` job installs
   proxied CNAMEs for apex, `www`, and `admin`, verifies config after writes,
   and refuses to overwrite an unowned A/AAAA/CNAME collision.
   The repository reserves 100 of Cloudflare's 1,000 Tunnel ingress rules;
   this topology therefore supports at most 300 three-host tenants per Tunnel
   pair before reconciliation fails closed and raises a critical capacity
   alert. Provision another reviewed Tunnel pair before reaching that limit.

   Cloudflare's DNS and Zone permissions are zone-scoped and do not include
   the account-scoped Tunnel permission. A token with every DNS/Zone box
   selected can therefore still receive `401`/`403` on the Tunnel API. The
   production readiness command reads both dedicated Tunnels and their
   configurations/connections with the exact runtime token; this proves read
   access only. Cloudflare currently accepts either Tunnel Read or Edit for
   those GET endpoints, so retain dashboard/policy evidence for Edit and prove
   the first controlled reconciliation separately.
5. Record the currently deployed renderer digest for rollback. Set
   `SIAB_RENDERER_IMAGE_DIGEST` to the digest emitted by the successful image
   workflow, then deploy `apps/renderer/compose.yml`. Confirm both container
   health checks pass and the tunnel reports connected. Confirm the host
   firewall, container runtime, and any upstream load balancer expose no route
   to renderer port `4321`.
6. Wait for Universal SSL on each hostname. The job requires Universal SSL,
   an active certificate pack covering the hostname, a healthy Tunnel
   connection, and the expected renderer/CMS service identity response.
   Certificate-pending is an expected persisted state.

## Required proving probes

Run these before enabling the commerce origin-isolation gate and after every
network or Tunnel change:

- An active apex through Cloudflare returns its own snapshot over valid HTTPS.
- Its explicitly active `www` hostname returns the same tenant.
- Its `admin` hostname reaches the CMS login for that tenant and not another.
- An active hostname on every enabled TLD follows the same path.
- A dedicated proxied probe hostname routed to the Tunnel but absent from CMS
  returns the neutral `404`, with no tenant content or analytics configuration.
- An inactive/cancelled hostname returns the neutral `404`.
- Automated renderer smoke tests prove Tenant A's host cannot retrieve Tenant
  B's snapshot or media.
- The renderer port is unreachable from outside the private container network.
  A disposable peer not attached to `renderer-origin` cannot connect.
- A client request through Cloudflare carrying an arbitrary
  `X-Siab-Origin-Verify` value has no effect; the obsolete header is not an
  authentication authority in Tunnel mode.
- Malformed, Unicode, and Punycode host probes match the renderer routing
  contract.
- Restart the renderer and Tunnel independently; active routing recovers
  without activating an unknown host.
- A certificate-pending hostname remains unpublished until an HTTPS probe
  validates the final customer hostname.
- Both remotely managed ingress arrays contain only exact active hosts plus a
  terminal `http_status:404`, and a spoofed/unknown admin host is rejected.

Only after all probes pass, set `COMMERCE_ORIGIN_ISOLATION_VERIFIED=1`, run the
commerce release-gate check again, and enable only the TLD/domain capabilities
whose separate evidence matrices also pass.

## Secret rotation

Revoke or rotate one Tunnel token through Cloudflare only during an approved
change, then replace only its token file and restart only that Tunnel
container. Never place a runtime Tunnel token in Payload or application env.

## Rollback

1. Unset `COMMERCE_ORIGIN_ISOLATION_VERIFIED` and stop new domain publication.
2. Keep customer DNS proxied through Cloudflare and keep the private Tunnel
   boundary. Restore `SIAB_RENDERER_IMAGE_DIGEST` to the recorded prior digest
   and roll back only the compose version to the last version already proven
   behind that Tunnel.
3. Never expose port `4321` or restore the public arbitrary-host
   Traefik/certificate route as a shortcut.
4. Re-run all proving probes. Resume publication only after HTTPS, host
   isolation, and direct-origin rejection pass.
5. If Tunnel service cannot be restored, leave the system fail-closed, preserve
   accepted orders and domain/DNS state, and follow the incident procedure.
