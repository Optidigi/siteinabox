# Runtime upgrade candidates — 2026-10-28

Research only, for `codex/dependency-modernization`, baseline `a1e7c33e`. Clock observed **2026-10-28 15:36:01 UTC**; eligibility cutoff **2026-10-27 15:36:01 UTC**. No builds, Docker operations, deployment, provider changes, policy exceptions, or CI polling were performed. Publisher APIs, release pages, source and downloaded artifacts were read directly. GitHub REST release queries returned rate-limit errors; HTML releases and Atom feeds supplied release evidence instead. Dates without times are sufficiently earlier than the cutoff; no midnight timestamp is invented.

## Coherent candidates

| Component | Recommendation and eligibility evidence |
|---|---|
| Node | **26.12.1-alpine**, released **October 21**; latest non-prerelease in the [official index](https://nodejs.org/dist/index.json). Its `lts` field is **false**. Latest observed 24-series LTS remains the supplied 24.22.1 baseline; retain that only if an actual LTS constraint prevents the requested newest supported release. The [schedule](https://github.com/nodejs/Release/blob/main/schedule.json) lists v26 LTS transition for **today**, maintenance October 20, 2027, EOL April 30, 2029. A calendar transition is not proof that this artifact has LTS metadata. Do not select v27 alpha. |
| Go native builder | **1.27.3-alpine**, unchanged; [download API](https://go.dev/dl/?mode=json) marks stable; [release history](https://go.dev/doc/devel/release#go1.27.0) dates 1.27.3 **October 19**. Go supports the two newest major lines; no separate LTS channel. |
| PostgreSQL | **18.6-alpine**, unchanged. [18.6 release notes](https://www.postgresql.org/docs/release/18.6/) date **August 13**. [Support table](https://www.postgresql.org/support/versioning/) lists 18.6 current, supported through **November 14, 2030**. PostgreSQL 19 RC1 is ineligible, despite its higher major number. Preserve the owned gosu remediation pending consumer/artifact evidence. |
| Nginx | **1.31.8-alpine**, unchanged, released **October 21** in [CHANGES](https://nginx.org/en/CHANGES). The [download page](https://nginx.org/en/download.html) labels this **Mainline** and **1.30.6 Stable**. Mainline is a released production channel, not an RC; choose it for newest supported, but do not relabel it the vendor's Stable branch. |
| cloudflared | **2026.10.5**, replacing 2026.10.4; [release](https://github.com/cloudflare/cloudflared/releases/tag/2026.10.5) published **October 27 13:31:37Z**, age **26h04m24s** at observation. Eligible, but not a remediation-complete candidate. |
| PowerShell / EXO | **7.6.9 / 3.10.1**, unchanged. [PowerShell release](https://github.com/PowerShell/PowerShell/releases/tag/v7.6.9) **October 25 17:26:05Z**, .NET SDK 10.0.403. [Gallery](https://www.powershellgallery.com/packages/ExchangeOnlineManagement/3.10.1) and its OData latest-stable query identify EXO **July 24 09:57:50.897Z**; 3.10 requires PowerShell **7.6+**. Preview releases are excluded. |
| Trivy | **0.76.1**, replacing 0.76.0; [release](https://github.com/aquasecurity/trivy/releases/tag/v0.76.1) **October 21 11:18:34Z**. Publisher specifically documents Go 1.27.3 and refreshed container CA trust; avoid rebuilding it merely to obtain those fixes. Atom `updated` is later, **13:56:00Z**, and is not the publication timestamp. |
| BuildKit / Dockerfile frontend | **0.34.1 / 1.28.0**, unchanged. [BuildKit](https://github.com/moby/buildkit/releases/tag/v0.34.1): **October 20 22:04:56Z**; [frontend](https://github.com/moby/buildkit/releases/tag/dockerfile/1.28.0): **October 7 23:37:56Z**. Exclude `labs` and RC tags. |
| Playwright / browsers | Upgrade together to **@playwright/test 1.64.1**, its exact `playwright: 1.64.1` dependency, and **mcr.microsoft.com/playwright:v1.64.1-noble**. [npm registry](https://registry.npmjs.org/@playwright/test) publishes **October 14 11:58:13.696Z**, Node engine **>=20**. The matching MCR manifest exists. Exclude npm `next` 1.65 alpha and beta. [Official image guidance](https://playwright.dev/docs/docker#pull-the-image) requires matching package/image versions. |

## Security findings: publisher upgrades do not suffice

Implementation selection: retain **Node 24.22.1 Krypton**. The root manifest
requires `>=24.22.1 <25.0.0`, and `scripts/check-toolchain.mjs` requires actual
LTS metadata. Node 26.12.1 is therefore a future migration candidate rather than
part of this compatible upgrade. Select cloudflared 2026.10.5, Trivy 0.76.1 and
the aligned Playwright 1.64.1 package/image family; retain the other current
supported pins listed above. These selections do not establish release clearance.

Downloaded the [official cloudflared linux-amd64 binary](https://github.com/cloudflare/cloudflared/releases/download/2026.10.5/cloudflared-linux-amd64) into memory. SHA256 **e1bc0cf084fd9e590554fe769a86b1db46701c3f847a43d902f7b974a4e16298** matches release notes. Embedded Go build metadata identifies revision `99b2eb2c0152862af2b1abf7c7b4e2170a46b9fe`, `vcs.modified=true`, build time October 27 13:25 UTC, and **x/crypto 0.58.0, x/net 0.61.0, go-jose/v4 4.1.4**. The [tag's go.mod](https://github.com/cloudflare/cloudflared/blob/2026.10.5/go.mod) agrees. Thus the newer vendor artifact does **not change these three vulnerable-module versions** from the recorded baseline. This binary inspection does not establish that every OCI platform contains identical bytes.

[GO-2026-5932](https://vuln.go.dev/ID/GO-2026-5932.json) flags **OpenPGP subpackages**, with introduced `0` and **no fixed version**. Merely raising x/crypto cannot cure an unmaintained API; module presence alone also cannot prove those packages are linked or reachable. Require package/symbol evidence. Retain the recorded x/net CVE-2026-78661 / CVE-2026-97045 and go-jose CVE-2026-116587 findings for exact advisory-range reconciliation; unchanged dependencies provide no upgrade-based closure. The repo records go-jose 4.1.6 as the required fix, but this bounded inspection does not independently establish a supported patched cloudflared artifact.

Downloaded [EXO 3.10.1](https://www.powershellgallery.com/api/v2/package/ExchangeOnlineManagement/3.10.1); SHA512 base64 **aPlz8t/GKd96eRD6Y8euTQFwjKtzdraI323x0Y1oo5xFa8CQQexu76vVJ9UW7FxBxnzVR5YBwIT/Kzj2PnWo6w==** matches Gallery metadata. `netCore/Microsoft.Exchange.Management.ExoPowershellGalleryModule.deps.json` declares **System.Security.Cryptography.Pkcs/10.0.0**. Its separate DLL contains product string **10.0.0**, assembly **10.0.0.0**, file string **10.0.25.52411**, SHA256 **26297734a7194fb6b6c08fff96036d9d212904b27a0581cfb131ee3cdcfd64bb**. Assembly version alone is not patch evidence. PowerShell's updated DLL cannot be assumed to replace EXO's private copy. Reconcile [CVE-2026-84008](https://msrc.microsoft.com/update-guide/vulnerability/CVE-2026-84008) separately from Windows-only [CVE-2026-70162](https://msrc.microsoft.com/update-guide/vulnerability/CVE-2026-70162); no unsupported DLL substitution is recommended.

Prefer a checksum-pinned supported publisher artifact with demonstrably corrected contents before owning rebuilds. Neither inspected vendor upgrade closes the remaining CF/EXO findings. A private rebuild adds source, toolchain, patch and qualification maintenance; it is not automatically the KISS answer. Do not remove esbuild, gosu or OS packages to make inventory smaller without proving consumers, entrypoints and native dependencies no longer require them.

## Exact OCI provenance

Read-only Registry V2 GETs, accepting OCI indexes/Docker manifest lists; index digests below came from `Docker-Content-Digest`. Each row is **index / linux-amd64 child** (all `sha256:`). Platform child and index are different objects. These are resolved pins, not proof of image publication age; image/config creation is not registry push time.

| Publisher registry manifest endpoint | Index / amd64 |
|---|---|
| [Node 26.12.1-alpine](https://registry-1.docker.io/v2/library/node/manifests/26.12.1-alpine) | `40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797` / `65fb44a19eb983bc475aebef8ca3416da172e5b7b0e52418cca100997959ca6e` |
| [Go 1.27.3-alpine](https://registry-1.docker.io/v2/library/golang/manifests/1.27.3-alpine) | `d200d2dd76b03a99b52651fd1325aff7dcd35422c35c01bac56571b0507f3deb` / `bff16a94c0b4b6d9642581e2a3aa81beb3edb940b2f5a3aac1d22c6a68cb7747` |
| [Postgres 18.6-alpine](https://registry-1.docker.io/v2/library/postgres/manifests/18.6-alpine) | `10a5c69a83035ab5239f5620d708520e8b28f5aa1f2b20143e6024532edadfb5` / `3b0ef735388b2cb097fc29b8bb421d86d57d0ddbe7aa1fbd6493e06d65028503` |
| [Nginx 1.31.8-alpine](https://registry-1.docker.io/v2/library/nginx/manifests/1.31.8-alpine) | `1ef7ca94d7879df82421428ce13bd1eaa412404953859cf7a5b6512c25e67a60` / `2db7d28517d1fba17c2da3210395f7be11a11b419246ad0da2edf782af72f367` |
| [cloudflared 2026.10.5](https://registry-1.docker.io/v2/cloudflare/cloudflared/manifests/2026.10.5) | `1b1d34d0a9c0bfca9de72db8460d328db3f19edd2b96169114e3e893a97bbe53` / `85b1ec2fdc5b311d309abd268f70eef071a595f011a38bf878938af25d084d17` |
| [Trivy 0.76.1](https://registry-1.docker.io/v2/aquasec/trivy/manifests/0.76.1) | `790fd66d1697395d8693d1acaa1ea702406a20f109b6fc7bac8db623eca6c06c` / `2e6c00d711ab4ae41d8a30c2c1fd3bd3b62704c177bb120f95012e939edfb3df` |
| [BuildKit v0.34.1](https://registry-1.docker.io/v2/moby/buildkit/manifests/v0.34.1) | `99368f3e46177c6405b9740e4461d91cee004128daeecca78d4ceac50ec1da5c` / `b651bf250c2805569f1db385ad1ea8fb73737dfc851de305f274ca02690fa93f` |
| [Frontend 1.28.0](https://registry-1.docker.io/v2/docker/dockerfile/manifests/1.28.0) | `bb22d9815c728170f72750f4e5b0d672e06176142e1d602c7e66c050100b7e5b` / `a14763ac9c4a34bf3447636e8f36ca714972817d425e40228bb3263be2769448` |
| [Playwright v1.64.1-noble](https://mcr.microsoft.com/v2/playwright/manifests/v1.64.1-noble) | `47b510dd9230bf0b9bfc9b20102241e577ea7a99334ab4c3ca19f19770e9b8ea` / `d65108d1a8095d8b0c4a5e32bf1807a40a5ce90ff0c78473e1116b1c243235e8` |

Additional checksums: [Node linux-x64 tar.xz](https://nodejs.org/dist/v26.12.1/SHASUMS256.txt) SHA256 `6170b2d474e1c626f43cff3adc118df9fe3b573258a4fc3d850c8dbc6b079bbd`; Go source SHA256 `6e7749035cf360f06b2575d162ea79df9fda8ef671889e5c375f8e50777f26bb`; PowerShell linux-x64 tar.gz release SHA256 `1DA6D6D6035D651F20E70DDEE7C4C15AC6AB8B9FB40EE92240D91263F28A884B`. These are artifact-specific, not OCI digests.

## Focused qualification for the implementing parent

Verify Node 26 engines/peer ranges across the actual pnpm graph, native ABI **147**, Alpine/musl support, esbuild execution and all app production builds. Run renderer and CMS request smoke tests. Upgrade Playwright package/lockfile and every browser container together; run existing browser smoke and visual comparisons. Check Nginx configuration/reload, static routing and health checks. Preserve PostgreSQL startup, ownership switching, persistence and backup/restore tests. Inspect final cloudflared image binary metadata and package reachability before tunnel/DNS/TLS smoke tests. For EXO, import under 7.6.9 and record actual loaded assembly locations/product versions without tenant operations. Re-inventory final native/managed files with Trivy 0.76.1 and reconcile exact advisory/platform ranges. No tests or rollout were executed by this research task.

Further dependency eligibility evidence: the [Go module proxy's x/net latest record](https://proxy.golang.org/golang.org/x/net/@latest) returns **0.62.0**, timestamp **2026-10-27 19:00:16Z**, source revision `3de643db506517b3e652a13cc0b56034cea6b8e6`. It is only **20h35m45s** old at observation, hence **ineligible under the 24-hour requirement**, even before considering rebuild compatibility. The [go-jose latest record](https://proxy.golang.org/github.com/go-jose/go-jose/v4/@latest) returns **4.1.6**, timestamp **October 14 22:46:21Z**, source revision `a0111f82742fa92bceec9ede40845e73319e6230`, old enough to qualify as a dependency candidate, but absent from the inspected vendor binary. The [x/crypto record](https://proxy.golang.org/golang.org/x/crypto/@latest) returns **0.58.0**, timestamp **October 9 16:24:17Z**: cloudflared already uses that latest module. This strengthens the need for package-level OpenPGP analysis rather than an invented fixed module version. Proxy timestamps identify source versions, not proof that a cloudflared publisher release incorporates them. Independently checking the Node release index confirms **24.22.1, October 20, Krypton** as its newest entry explicitly marked LTS. Candidate recommendations therefore preserve the distinction between release availability, support channel, dependency remediation and artifact qualification.

## Subsequent packaged qualification

The implementing agent subsequently verified CMS, renderer, site and owned
PostgreSQL at `2e227ae4`; their Trivy 0.76.1 inventories contain no findings or
analysis gaps. Worker qualification at `d1663041` passes module/installer,
runtime-inventory, authenticated health and unauthenticated-rejection checks.
These local receipts precede required final-source hosted CI and publication.

The actual cloudflared OCI executable has SHA256
`5bec754ab74f88a35ba4b0edc2e0c4555da1f526a8ca866c9a8383ea84d286db`,
different from the release-download executable above. Govulncheck **1.9.0**
binary symbol analysis retains GO-2026-5932/6860/6866 only at module level.
Its extraction enumerates **34,609** symbols, with no OpenPGP or `x/net/html`
package. Scoped nonaffected decisions bind to this OCI binary's native
fingerprint. The go-jose RSA private-key parser remains present; its high finding
is unresolved. [Debian DSA-6572-1](https://lists.debian.org/debian-security-announce/2026/msg00487.html)
also confirms the old CA bundle needs `20250419+deb13u1`; unknown scanner severity
and incomplete advisory aliases remain blocking. No release clearance is claimed.

Worker import and an explicit `Assembly.LoadFrom` request for the module's old
private Pkcs both resolve to host **10.0.14**, exclusively in the Default context.
This follows [.NET assembly resolution rules](https://learn.microsoft.com/en-us/dotnet/core/dependency-loading/understanding-assemblyloadcontext).
The retained inventory binds requested/resolved paths and hashes, all loaded
Pkcs paths, and the worker entrypoint hash; the verifier rejects a changed
entrypoint, old host patch or alternate resolution. The old DLL stays inventoried.
PE-header inspection also classifies 12 unmanaged Windows-native DLLs separately
from managed assemblies; two absent-target compatibility links retain their
targets without inventing component bytes. Corrupt/unclassified DLLs still fail
coverage. These concrete results replace the previous worker mapping gaps.
