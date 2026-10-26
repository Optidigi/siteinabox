# Exchange Online worker

The CMS delegates mailbox verification, optional `info@` alias/forwarding and
DKIM operations to this small private PowerShell service. It uses the connected
partner user's short-lived Exchange token with `-UserPrincipalName` and
`-DelegatedOrganization`; customer app-only credentials are not used.

## Build and qualification

Build separately from the three application images:

```bash
docker build --pull -t siteinabox-exchange-worker:candidate ops/exchange-worker
docker run --rm --entrypoint pwsh \
  --mount type=bind,src="$PWD/ops/exchange-worker/Test-ExchangeWorker.ps1",dst=/tests/contract.ps1,readonly \
  siteinabox-exchange-worker:candidate -NoLogo -NoProfile -NonInteractive \
  -File /tests/contract.ps1 -WorkerPath /app/Invoke-ExchangeWorker.ps1
```

The Dockerfile pins Ubuntu, PowerShell package SHA256 and Exchange module
version. The native PowerShell contract test loads the actual worker job
function and substitutes Exchange commands; it checks delegated identity,
read access, licensed-mailbox protection, alias conflicts and DKIM DNS gating.
It never connects to Microsoft. Run an authenticated `/health` smoke on the
actual candidate container as well; it must report protocolVersion1, installed
Exchange module and `dig`. Scan/review OS and PowerShell/module dependencies
through the deployment security process, then retain the image archive, hashes,
source revision and smoke evidence. Publish only those approved bytes under
`ghcr.io/optidigi/siteinabox-exchange-worker` and record its immutable digest.
The existing CMS/renderer/site publisher does not accept a worker image.
No worker image is published or deployed by this implementation task.

## Runtime

Overlay the CMS Compose file with `ops/exchange-worker/compose.yml` from the
repository root (resolve paths/env using the deployment's existing convention).
Set `SIAB_EXCHANGE_WORKER_IMAGE_DIGEST` and the same runtime
`EXCHANGE_WORKER_SHARED_SECRET` in both services. The overlay sets the CMS URL
to the exact private address `http://siteinabox-exchange-worker:8081/jobs`.
All remote worker URLs require HTTPS. There are no published ports. The bridge
permits outbound Microsoft/DNS traffic; the worker has a read-only root,
unprivileged user, dropped capabilities and temporary writable home/tmp.
Do not expose the worker through a public tunnel or log request bodies/tokens.
Use a randomly generated secret of at least32 characters; store it in deployment
secrets, never in the image or repository.

The listener serves authenticated `/health` and `/jobs`. Jobs are narrow JSON
operations, not shell commands. They carry a short-lived delegated Exchange
token for a verified initial customer `.onmicrosoft.com` domain. Failures return
sanitized codes only. A client timeout or ambiguous response is held by the CMS
for reconciliation. The service serializes requests and disconnects Exchange
at the end of each job. Keep the partner roles and module version qualified
before enabling orders.

`verify_access` reads organization configuration. `verify_mailboxes` checks
that the requested addresses exist in Exchange before MX cutover.
`ensure_info_alias` uses `Set-Mailbox` and rejects conflicting recipients.
`ensure_info_forward` creates an unlicensed shared mailbox when absent, preserves
a configured external destination and enables forwarding only for that mailbox.
An existing licensed mailbox requires review and is never converted.
`get_dkim_targets` prepares a disabled DKIM configuration; `enable_dkim` requires
both CNAMEs to resolve to Microsoft's targets before switching signing on.

The local implementation verification parsed/ran PowerShell and exercised the
mocked command contract. The Docker build and live GDAP/Exchange connection must
be qualified in the deployment phase before the first real customer order.
