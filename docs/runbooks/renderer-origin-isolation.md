# Renderer origin isolation

Status: code-controlled topology is implemented; production Cloudflare and
network evidence remains approval-gated. Do not set
`COMMERCE_ORIGIN_ISOLATION_VERIFIED=1` from repository tests alone.

## Security contract

Cloudflare terminates customer TLS. A dedicated remotely managed Cloudflare
Tunnel makes an outbound connection to Cloudflare and forwards traffic to
`http://siteinabox-renderer:4321` on the private `renderer-origin` container
network. The renderer has no published port, public Traefik route, or
customer-host certificate resolver.

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

1. Inventory current tunnels, renderer listeners, DNS records, zone rulesets,
   Universal SSL state, and firewall exposure read-only. Confirm there is no
   existing suitable Siteinabox renderer tunnel before creating one. Do not
   repurpose an unrelated tunnel.
2. Create one remotely managed tunnel dedicated to the Siteinabox renderer.
   Its only HTTP origin is `http://siteinabox-renderer:4321`. Do not configure
   an origin `Host` override.
3. Store the tunnel token in
   `/srv/saas/secrets/siteinabox-renderer-tunnel-token` and a separately
   generated renderer/CMS bearer value in
   `/srv/saas/secrets/siteinabox-renderer-api-token`. Files must be owned by
   numeric UID/GID `1000:1000` and mode `0600`, matching both explicitly
   unprivileged compose services. If the host deployment account uses another
   UID, install the files with `1000:1000` ownership rather than weakening
   their mode.
4. Create proxied CNAME records for each approved apex and explicit `www`
   hostname to `<TUNNEL_UUID>.cfargotunnel.com`. Cloudflare CNAME flattening
   handles an apex. Do not route a hostname until CMS domain ownership,
   entitlement, DNS, and publication prerequisites are satisfied.
5. Record the currently deployed renderer digest for rollback. Set
   `SIAB_RENDERER_IMAGE_DIGEST` to the digest emitted by the successful image
   workflow, then deploy `apps/renderer/compose.yml`. Confirm both container
   health checks pass and the tunnel reports connected. Confirm the host
   firewall, container runtime, and any upstream load balancer expose no route
   to renderer port `4321`.
6. Wait for Universal SSL on each hostname. Persist certificate-pending as an
   expected waiting state; do not publish merely because DNS resolves.

## Required proving probes

Run these before enabling the commerce origin-isolation gate and after every
network or Tunnel change:

- An active apex through Cloudflare returns its own snapshot over valid HTTPS.
- Its explicitly active `www` hostname returns the same tenant.
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

Only after all probes pass, set `COMMERCE_ORIGIN_ISOLATION_VERIFIED=1`, run the
commerce release-gate check again, and enable only the TLD/domain capabilities
whose separate evidence matrices also pass.

## Secret rotation

Revoke or rotate the Tunnel token through Cloudflare only during an approved
change, then replace the token file and restart only the Tunnel container.

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
