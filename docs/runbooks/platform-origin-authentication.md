# Platform origin authentication

The platform admin, preview, intake, contact, and marketing routes intentionally
use:

```text
browser -> Cloudflare -> public Traefik -> application
```

Customer website and `admin.<customer-domain>` routes continue to use the
private renderer and CMS Cloudflare Tunnels. Do not move the platform routes
into those customer-host ingress arrays.

Traefik must authenticate Cloudflare before serving any `siteinabox.nl` HTTPS
router. A proxied DNS record and a valid origin certificate encrypt traffic but
do not prevent a client that knows the VPS address from bypassing Cloudflare.
Siteinabox therefore uses a zone-specific Authenticated Origin Pull (AOP)
certificate and Traefik mTLS.

## Repository-owned configuration

- `ops/traefik/cloudflare-aop.dynamic.yml` defines the
  `siteinabox-cloudflare-aop@file` TLS option with TLS 1.2 minimum, strict SNI,
  and `RequireAndVerifyClientCert`.
- `ops/traefik/cloudflare-aop.static-flags.txt` lists the static file-provider
  flags that the base Traefik command must include.
- `ops/traefik/compose.cloudflare-aop.yml` mounts the dynamic configuration and
  AOP CA certificate.
- Every platform HTTPS router in the CMS, landing, and intake compose files
  selects that exact TLS option.
- `pnpm renderer:deploy-contract` fails when a platform router loses the
  option or the mTLS configuration weakens.

The CA certificate is public configuration, but the CA private key, leaf
private key, API token, certificate upload payload, and provider response are
production secret state and must never be committed.

## Zero-downtime enablement

Cloudflare zone-level AOP requires a leaf client certificate and private key
signed by a CA whose public certificate Traefik trusts. Use a dedicated CA for
the `siteinabox.nl` zone. Keep the CA signing key in the approved production
secret store; delete the temporary leaf key after Cloudflare accepts it.

The Cloudflare setup credential needs `Zone / SSL and Certificates / Edit`
limited to `siteinabox.nl`. It is an operator credential, not a CMS runtime
dependency.

1. Back up the Traefik compose file and record current public route results.
2. Verify the zone uses `Full` or higher, then set it to `Full (strict)` and
   prove every proxied platform route still succeeds. Do this before AOP
   certificate upload or enablement; Cloudflare requires Full or higher for
   AOP.
3. Generate the dedicated CA and leaf client certificate according to
   Cloudflare's current zone-level AOP contract. The leaf must have
   `basicConstraints=CA:FALSE`.
4. Upload the leaf certificate and private key to Cloudflare. Wait until the
   certificate is active.
5. Copy the three repository-owned files under `ops/traefik/` to
   `/srv/ops/infra/stacks/traefik/`. Set the following in that directory's
   mode-0600 `.env`:

   ```dotenv
   SIAB_CLOUDFLARE_AOP_CA_FILE=/srv/ops/secrets/siteinabox-cloudflare-aop-ca.pem
   ```

   Add every line from `cloudflare-aop.static-flags.txt` to the base Traefik
   service's `command` list. Traefik static configuration must use one
   consistent source: a deployment that already supplies CLI flags cannot
   rely on environment variables to activate an additional provider.

   Validate and start the exact merged stack:

   ```bash
   cd /srv/ops/infra/stacks/traefik
   docker compose \
     -f compose.yaml \
     -f compose.cloudflare-aop.yml \
     config --quiet
   docker compose \
     -f compose.yaml \
     -f compose.cloudflare-aop.yml \
     up -d --no-deps traefik
   docker inspect traefik --format '{{.State.Health.Status}}'
   docker logs --since 5m traefik 2>&1 | grep \
     'Starting provider \\*file.Provider'
   ```

   Inspect the merged command with `docker compose config` and confirm both
   file-provider flags are present. At this point no existing router refers to
   the option, so traffic remains unchanged. A missing file-provider start
   message, CA-read error, or TLS-option error stops rollout.
6. Enable **zone-level** AOP for `siteinabox.nl`. Do not toggle the weaker
   global/shared AOP setting.
7. Confirm the proxied platform routes still succeed.
8. Deploy the reviewed CMS, landing, and intake compose files. Their router
   labels now enforce `siteinabox-cloudflare-aop@file`.
9. Confirm Cloudflare routes succeed:

   ```bash
   curl --fail --silent --show-error https://siteinabox.nl/ >/dev/null
   curl --fail --silent --show-error https://www.siteinabox.nl/ >/dev/null
   curl --fail --silent --show-error https://admin.siteinabox.nl/api/health >/dev/null
   curl --fail --silent --show-error https://preview.siteinabox.nl/ami-care >/dev/null
   ```

   Then prove direct HTTPS to the VPS fails without a client certificate. Set
   `ORIGIN_IP` to the reviewed VPS address; do not derive it from proxied DNS:

   ```bash
   for host_path in \
     'siteinabox.nl:/' \
     'www.siteinabox.nl:/' \
     'admin.siteinabox.nl:/api/health' \
     'preview.siteinabox.nl:/ami-care'
   do
     host=${host_path%%:*}
     path=${host_path#*:}
     if curl --noproxy '*' --fail --silent --show-error \
       --connect-timeout 5 --max-time 10 \
       --resolve "${host}:443:${ORIGIN_IP}" \
       "https://${host}${path}" >/dev/null
     then
       echo "Direct-origin bypass remains open for ${host}" >&2
       exit 1
     fi
   done
   ```

   Run this for:
   - `siteinabox.nl`
   - `www.siteinabox.nl`
   - `admin.siteinabox.nl`
   - `preview.siteinabox.nl`
10. Set the Cloudflare edge minimum TLS version to 1.2 and re-run the probes.

Do not enable mandatory client authentication before Cloudflare has activated
the matching leaf certificate. Do not make the AOP option Traefik's global
default; unrelated domains on the shared proxy have independent origin
contracts.

## Rotation

Upload and activate a newly signed leaf before deleting the previous Cloudflare
certificate. When rotating the CA itself, temporarily trust both old and new CA
certificates in the mounted PEM bundle, activate the new leaf, verify proxied
traffic, then remove the old CA and certificate. Configure Cloudflare's AOP
expiration notifications.

## Rollback

If proxied traffic fails before mandatory enforcement, disable zone-level AOP
and restore the prior Traefik stack. If failure occurs after router enforcement,
first restore the previous application compose files (removing the AOP TLS
option), verify public recovery, and only then disable AOP. Never expose CMS or
renderer application ports directly as a workaround.
