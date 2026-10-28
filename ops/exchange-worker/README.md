# Exchange Online worker

The CMS delegates mailbox verification, optional `info@` alias/forwarding and
DKIM operations to this small private PowerShell service. It uses the connected
partner user's short-lived Exchange token with `-UserPrincipalName` and
`-DelegatedOrganization`; customer app-only credentials are not used.

## Build and qualification

Canonical CI now includes the required `exchange-worker` job. It builds the actual
image, runs the offline command contract and checks authenticated/unauthenticated
HTTP health with networking disabled and no published ports. Trusted main retains
the worker archive for separate security/release qualification. The shared publisher includes the worker as a closed choice, but its complete
security review and configured owner approval remain mandatory.

The listener prefix is `http://+:8081/`: .NET HttpListener rejects `0.0.0.0` as a
prefix. The Compose bridge remains private and publishes no ports.


Build separately from the three application images:

```bash
docker build --pull -t siteinabox-exchange-worker:candidate ops/exchange-worker
docker run --rm --entrypoint pwsh \
  --mount type=bind,src="$PWD/ops/exchange-worker/Test-ExchangeWorker.ps1",dst=/tests/contract.ps1,readonly \
  siteinabox-exchange-worker:candidate -NoLogo -NoProfile -NonInteractive \
  -File /tests/contract.ps1 -WorkerPath /app/Invoke-ExchangeWorker.ps1
```

The Dockerfile pins Ubuntu and PowerShell 7.6.9 by package SHA256 and services
inherited Ubuntu packages during build. The verified upstream DEB runs .NET
10.0.14; this is not a claim about every bundled module DLL. Packaged qualification
retains recursive runtime/module file hashes and managed assembly/file/product
metadata, plus the complete dpkg inventory, bound by hashes in the worker receipt.
Alternate-platform and duplicate copies are retained. Unmapped DLLs remain
explicit metadata gaps; independent native analysis and package/advisory mapping
are still required. Inventory collection does not grant release clearance.

The Dockerfile pins Ubuntu and the PowerShell package SHA256. `modules.json`
pins the Exchange module and its PowerShellGet/PackageManagement dependencies by
version and SHA256. The installer downloads exact official Gallery archives,
checks their bytes and manifests, and imports the Exchange module without
connecting to Microsoft. These archive hashes were checked against the Gallery
SHA512 package metadata. The installer uses the official CDN URLs returned by the Gallery package API,
with bounded retries and timeouts; both the version-search and package API
frontends returned 404 during image qualification despite CDN availability.
The offline installer test proves that incorrect bytes are rejected before
extraction or manifest use. Changing module bytes requires a reviewed catalog update. The native PowerShell contract test loads the actual worker job
function and substitutes Exchange commands; it checks delegated identity,
read access, licensed-mailbox protection, alias conflicts and DKIM DNS gating.
It never connects to Microsoft. Run an authenticated `/health` smoke on the
actual candidate container as well; it must report protocolVersion1, installed
Exchange module and `dig`. Scan/review OS and PowerShell/module dependencies
through the deployment security process, then retain the image archive, hashes,
source revision and smoke evidence. Publish only those approved bytes under
`ghcr.io/optidigi/siteinabox-exchange-worker` and record its immutable digest.
The shared publisher consumes this worker archive with runtime/module/dpkg
provenance and the same exact-source/rescan/approval gates as the other images.
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
