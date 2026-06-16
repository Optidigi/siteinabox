# Existing Tenant Redeploy

Use this checklist when rolling a compatibility-affecting site contract change
to existing tenants.

## Tenant Inventory

Current known CMS-backed production tenants from the OBS-56/OBS-40 backlog:

- `amicare-zorg`

`amblast` and `siteinabox` are not CMS-ified yet. They should go through the
normal `/add-cms` flow first; do not treat them as redeploy-only tenants.

Confirm the live tenant ID and VPS data path before running commands. Do not
assume IDs from local dev databases.

## Per-Tenant Sequence

1. Confirm the site package under `sites/<slug>` is on the current
   post-Phase-D contract:
   - RtRoot block renderer present.
   - `siteManifest.json` present.
   - block renderers consume `block.anchor`.
   - `pnpm build` produces `dist/cms/cms-editor.css`.
2. If the tenant still has old rich-text projection JSON, run the Payload
   repopulate flow from the `siab-payload` container using the canonical old
   snapshot for that tenant.
3. Push the monorepo and wait for the tenant image build.
4. Sync CMS artifacts on the Docker host:

   ```bash
   scripts/sync-cms-artifacts.sh \
     --image ghcr.io/optidigi/siteinabox-site-<slug>:latest \
     --tenant-dir /srv/data/saas/siab-payload/tenants/<tenantId>
   ```

5. Restart the site service with the tenant data directory mounted `:ro`.
6. Smoke-check:
   - live site returns 200;
   - `/healthz` returns 200;
   - a visible rich-text field renders from RtRoot JSON;
   - navigation anchors land on the expected sections;
   - Payload canvas uses tenant fonts/theme from `cms-editor.css`;
   - editing a visible field in Payload updates the live site on hard refresh.

## Closure Rule

OBS-40 closes after Amicare has been verified on the current contract using the
artifact-sync path. OBS-56 closes only after Amblast and SiteInABox have gone
through `/add-cms` and have also been verified on the current contract.
