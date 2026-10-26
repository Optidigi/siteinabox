# Current dependency evidence

`dependency-security.json` owns reviewed conditional dispositions, publisher
facts, graph/configuration identities, review ownership and expiry. It is not a
blanket acceptance of risk. The October 7 candidate reviewed until October 14 is
historical; its dates and findings were not copied forward as current evidence.

The October26 Microsoft mail refresh requalifies the changed source graph and
configuration, including the exact jose6.2.13 publisher identity. Fresh audits
retain the three prior source findings and add ten full/production fast-uri and
happy-dom findings, for13 source dispositions. All remain release-blocking.
The current image record contains 287 dispositions, including all 210 prior
findings. Five blocked native assessments, seven deferrals and the original
October 28 expiry are retained. This refresh qualifies source inventory
only; final candidate image evidence and production-release clearance remain
separate. Independent review found no waived findings or weakened controls.

## PR126 exact-image reconciliation

Canonical run 40404485218 attempt 1 passed all application tests, the compiled
browser journey and CMS/renderer/site image startup checks at source
`7c19493ba5395218e721a66d6e206ccfabc5b4bb`. The aggregate correctly rejected
unreviewed image inventory changes. Current retained reports contain 287
findings: all 210 prior identities plus 77 newly enumerated curl/libcurl,
global-npm undici and cloudflared chi findings. Primary Alpine/upstream
advisories support the retained affected versions and remediation references.
All 287 remain release-blocking. Three Go CVE-2026-111943 selected scanner
labels changed from high to moderate; raw multi-vendor provenance remains,
and no safety or reachability conclusion follows from that label change.

All five native assessments remain blocked. Only the CMS fingerprint changes:
its eight runtime helper sizes and SHA256 values exactly match the owning
repository-root generator. Substituting the prior helper list reproduces the
prior fingerprint, proving the OS/native files and Go targets are unchanged.
Fresh exact-source CI evidence is still required after this policy commit;
these records authorize neither publication nor deployment. Source findings,
deferrals, publisher constraints and the original October 28 expiry remain.

## Commands and scope

Use the exact project Node LTS and pinned pnpm from the repository root:

```bash
pnpm dependency:policy:test
pnpm dependency:inventory
pnpm dependency:check
pnpm dependency:release --images artifacts/candidate-images --archive-dir artifacts/candidate-images
```

The first command tests failure and positive behavior with controlled fixtures.
Inventory collects full and production audits separately plus current primary
publisher facts; it does not approve its own findings. `dependency:check`
qualifies the source inventory against the reviewed record. Its source-only
result is explicitly not native/OS or release clearance. CI's aggregate adds all
three application inventories and the pinned PostgreSQL/cloudflared inventories.
Missing, changed, unknown, expired or unavailable review evidence fails; reviewed
blockers may qualify an inventory while dependency release readiness stays false.

`dependency:release` collects fresh source evidence and requires a clean exact
candidate, complete image evidence and qualified native assessments. With
`--archive-dir`, it rescans retained verified bytes rather than rebuilding them.
The directory contains `image-{cms,renderer,site}.json` and their archives, plus
CMS's PostgreSQL/cloudflared archives and associated reports. `--candidate SHA`
can evaluate a main ancestor using an owned temporary worktree; the current
trusted policy must actually cover that candidate's graph/configuration. An old
green run or a different source does not become current by inference.

Known advisory rows are release blockers; clearing a boolean does not waive
them. Accepted-risk exceptions are not implemented by this gate. A material
constraint needs the separately scoped owner decision and reviewed enforcement,
not an inventory refresh or an agent's invented approval. Supported-version
compatibility deferrals have a reason, surface, owner and an enforced recheck
expiry; they cannot override an advisory blocker.

## Identity and freshness

The October 23 cohesion refresh reconciles the withdrawn braces advisory:
GitHub records withdrawal at 12:53:02 UTC and fresh full/production npm audits
now omit it. Its two current dispositions are removed only after that agreement;
Git history and the retained publisher fact preserve the earlier evidence. At that point three
source findings, seven blocked deferrals, 210 image dispositions and five blocked
native assessments remained, with the original October 28 expiry. New Alpine
libraw/libde265/nsd entries are absent from the retained OS package inventories;
bundled/native qualification and final-candidate image checks remain blocked and
mandatory respectively. No ignore, waiver, dependency upgrade or expiry extension
is introduced.

The current npm inventory additionally reports GHSA-mrhx-c7xc-m3w5 in Zod 4.4.3
for both full and production scopes. Its retained primary advisory marks versions
below 4.6.6 affected by memory exhaustion and identifies 4.6.6 as fixed. Both
exact-path dispositions are high severity and release-blocking; configured
reachability and compatible remediation remain unqualified. No dependency version
is changed or finding suppressed. Fresh packaged reports retain the same 210
findings and all five native fingerprints.

Final cohesion inventory retains all 208 prior identities/severities/paths,
refreshes 103 reference/vendor-severity fact hashes and adds two high-severity
CVE-2026-111497 rows for PostgreSQL/landing brotli-libs. This is the already
recorded unresolved publisher issue, now enumerated by the scanner. Native
fingerprints remain unchanged; all 210 rows and five native assessments remain
release-blocking. Raw-report admission and the original expiry stay mandatory.

The earlier workflow-efficiency refresh retained the October 28 expiry, every
advisory and all five blocked native assessments. Its Alpine main feed added Node
24.22.1-r0 security entries and CVE-2026-111497 under its unresolved zero entry.
The existing blocked Node patch qualification now records these vendor facts;
upstream release metadata does not prove applicability or remediation of official
image binaries. No runtime pin or release decision changes. Final candidate raw
inventories remain required; comparison/receipt tools do not grant clearance.
That baseline retained the same 208 identities/severities/paths and all five
native fingerprints; refreshed references/vendor-severity provenance updated
100 facts hashes. The feed also records Brotli 1.2.1-r0 for CVE-2026-111497:
retained PostgreSQL/landing inventories ship brotli-libs 1.2.0-r1, while those
scanner reports omitted that entry. An explicit unresolved deferral and both
blocked native reasons retained this gap. Tomcat-native feed additions were absent from the
retained application/infrastructure inventories. No expiry or blocker is waived.

Graph identity covers all tracked workspace manifests, both lockfile documents
and workspace policy. Configuration identity covers tracked application/package,
build, workflow, infrastructure and checker inputs. The review file itself is
excluded to avoid a self-referential digest. Actual receipts additionally bind
clean source SHA, reviewed-policy SHA/hash, source-evidence hash, image ID,
archive/report/native hashes, scanner bytes and database identity. Hosted source
receipts must belong to the current run/attempt.

Review duration is at most seven days. Changing an expiry alone is insufficient:
current inputs, both audits, primary facts and applicable image inventories must
still match. Any incompatible source/graph/path/severity/fix/native change needs
fresh review. Publisher floors independently prevent known regressions even when
an audit database omits a notice. Public metadata uses credential-free HTTPS
first. Only a GitHub HTTP 403 explicitly reporting exhausted anonymous quota may
retry through existing CLI authentication, restricted to the same allowlisted
public metadata paths. Organization-access errors and other failures remain
blocking; no new provider credential or application startup variable is needed.

Trivy 0.76.0 is isolated and verified against pinned official asset, checksum and
binary digests. Collection disables telemetry, inherited scanner overrides and
ignore-file loading, retains every severity/unfixed finding, and bounds process,
input and output sizes. Database content/metadata hashes are recorded before and
after scanning. `UpdatedAt` must be at most 24 hours old; future, expired or
inconsistent metadata fails. Download time alone is not advisory freshness.
Operational failures, malformed/truncated data and unknown analysis warnings
cannot produce clearance. The exact pinned Trivy notice about cross-vendor
severity selection is retained as provenance, along with severity-source/vendor
fields and raw diagnostics; it does not suppress findings. See the publisher’s
[severity-selection contract](https://trivy.dev/docs/v0.76/guide/scanner/vulnerability/#severity-selection).

The pinned scanner can also report a missing vulnerability-detail record while
retaining vendor package/fix evidence. Collection accepts that exact diagnostic
only when its CVE matches retained package findings with `UNKNOWN` severity and
unresolved advisory metadata. It preserves the warning and every finding and
labels the inventory `incomplete`. Admission recomputes that label from the raw
report. Such rows require explicit reviewed dispositions and still block release;
they are not evidence of CVE rejection or safe packages. Missing/mismatched rows,
other warnings and operational errors still fail collection.

The image path exports a never-started, labelled container filesystem. Native
magic is inspected for every regular member, regardless of name or permissions.
Detected native members and bundled migration code are hashed through tar pipes without host
extraction, symlink traversal, model calls or application jobs. Node's full
`process.versions`, CMS's full `sharp.versions`, OS inventories and artifact
identities remain visible. Native assessments bind the exact bundled-script
paths and hashes; changed, added or removed bundles require fresh review, without
revision normalization. Independent Go-binary presence must be reconciled
with analyzer coverage. A controlled newer-esbuild probe was not catalogued by
the selected scanner; this is an explicit analysis blocker, never a zero-finding
result. Missing advisory URLs remain explicit unresolved-source findings with
retained database provenance, never inferred URLs or dropped findings. Resolving
that source changes the reviewed fingerprint. Completed image smoke tests do
not clear native advisory uncertainty.

## CI, drift and publication

The verification matrix owns the policy fixtures and source-inventory command.
`required-ci` authenticates canonical results and exact-source packaged records,
then matches current source/native inventory to the review. Required green CI is
engineering evidence; dependency release readiness can still be blocked.

The weekly main-only `dependency-security` workflow and manual inventory reuse
these commands and the unpublished verifier. They detect changed/unavailable or
expired evidence and retain diagnostics; they never update dependencies, publish
images or deploy. Native/OS inventories are collected from actual bytes rather
than inferred from the npm graph. Complete JSON and diagnostic files are retained
as artifacts; terminal excerpts are not the review record.

Publication remains separately approved for one selected image/source/run. Before
registry login it rejects declared dependency blockers and validates fresh
candidate readiness. Supplemental images are downloaded/scanned only; that does
not authorize their publication. Fresh source, native and scanner receipts are
retained with the immutable publication result. The loaded archive/image ID stays
bound to the verified bytes, and publication never rebuilds the candidate.

## Current frontier

### M17 product policy qualification

Source `b3cfc4a2d78702f3381dce404231d452ba97c842` adds the separate governed
product-policy draft and locale-bound consumers. Fresh full/production audits and
all 110 publisher facts match the prior reviewed findings/facts. Graph and source
configuration bindings change; the runtime/dependency pins do not.

Unpublished workflows [CMS 40038419830](https://github.com/Optidigi/siteinabox/actions/runs/40038419830),
[renderer 40038422502](https://github.com/Optidigi/siteinabox/actions/runs/40038422502)
and [site 40038425132](https://github.com/Optidigi/siteinabox/actions/runs/40038425132)
at attempt 1 retain exact-source inventories. All 210 image rows, including their
facts hashes, are unchanged. Four native fingerprints are unchanged. CMS native
files and Go targets are also unchanged; its eight bundled helper scripts match
the actual local output of the owning pinned generator byte for byte. Their new
paths, sizes, hashes and hosted source/image/archive/report/native receipts are
recorded in the policy. The archive hashes are hosted receipts, not a claim of
local archive extraction or release qualification.

The actual compiled CMS/browser/renderer journey at source `393a9b99` passes 27 boundary assertions,
including the private blocked NL/EN source draft and separate synthetic review
and publication states; the checkout Chromium journey verifies exact locale-bound
statements and version links. The guarded environment supplies the same legal
asset root as Docker, and build reuse binds that root. No SQL schema migration is
introduced. M16's populated migration rehearsal remains historical evidence.

The checkout follow-up copies the validated scalar legal identity before
asynchronous work and rejects a changed ID/version/hash/statement before order or
acceptance writes. All 52 focused checkout/service/action regressions pass;
publication changes require fresh confirmation instead of silently substituting
unseen terms. The later source changes no UI components or renderer code.

The separately invoked invitation build and browser reuse stages share one owned
legal-asset environment constructor. Ten focused harness/option tests pass,
including matching producer/consumer fingerprints and rejection of a different
legal root. This test-only correction changes no shipped runtime/helper bytes;
final canonical CI must prove the actual two-step build/reuse sequence.

All three source findings, seven blocked deferrals, 210 image findings and five
blocked native assessments remain. All five inventories remain incomplete, and
the original October 28 expiry is unchanged. Actual issuer/controller/provider
facts, legal approval, activation and privacy assurance remain separate gates.
These source-candidate receipts do not replace final-policy-head canonical CI
and image admission; require those fresh final receipts before protected merge.

### M16 workspace qualification (historical baseline)

M16 preserves the frozen dependency graph, all 109 current publisher facts,
three source findings, every existing disposition and the original October 28
expiry. Source configuration was rechecked for the independently reviewed
private-workspace implementation; this does not qualify deferred upgrades.

Final PR qualification reproduced an upstream Next font URL-parser build
failure after all 351 CMS test files and 2,711 tests passed. CMS font bytes and
face declarations are now retained locally with their licenses and original
metrics. The image compile step disables networking. This leaves the dependency
graph and native helpers unchanged; final-head image and browser checks must
verify the new packaging. This is not an advisory remediation or release waiver.

Unpublished source `8830859fe07785b42735c9ac94060af44cf1317c` passed the existing
verify-only workflows for [CMS](https://github.com/Optidigi/siteinabox/actions/runs/39858729434),
[renderer](https://github.com/Optidigi/siteinabox/actions/runs/39858733547) and
[site](https://github.com/Optidigi/siteinabox/actions/runs/39858737791), each at
attempt 1. Retained raw reports reconstruct exactly the same 208 image findings,
including identities, paths, severities and evidence hashes. All five inventories
remain incomplete, and all five native assessments remain blocked.

OS/native files and Go targets are unchanged. The CMS fingerprint changes only
for its eight shared-configuration helper bundles; their actual paths, sizes and
hashes exactly reproduce with the repository-root generator. The new boot bundle
passed old/new empty, populated and idempotent migration rehearsals with all rows,
the active snapshot and credentials preserved. Legacy down succeeds; down with
unresolved null-domain data refuses without loss. Fresh final-policy-head
canonical CI, packaged-image verification and independent evidence review remain
required. These baseline receipts authorize no release, publication or provider
operation.

### Tooling recovery baseline

The tooling recovery rechecked the unchanged dependency graph and current
publisher inputs after the Node/scanner release-age deadlines. Those patches
are now eligible, but remain unqualified release blockers. Current Alpine main
also adds BIND and nginx fix rows; the retained CMS validator predates the BIND
fix and needs fresh qualification. New Docker/Compose/buildx community rows do
not match packages in the retained inventories. A fresh isolated rescan still
reports missing musl advisory details. These UNKNOWN findings are retained as
incomplete evidence under the rules above, never suppressed or treated as CVE
rejection. Final-candidate image reports and independent review remain required;
the original global review expiry is unchanged.

[Tooling qualification run 39845654818, attempt 1](https://github.com/Optidigi/siteinabox/actions/runs/39845654818)
retains 208 image findings: the prior 198 plus eight UNKNOWN musl rows and two
shipped `ip-address` findings covered by its owner's advisory. None disappear.
All five native assessments remain blocked. Four native fingerprints are
unchanged; CMS changes only BIND executables/libraries to 9.20.30 and retains
identical bytes for all eight helper bundles. These reviewed baseline receipts
still require final-policy-head verification and never authorize release.

The current reviewed baseline inventory comes from unpublished source
`068397b789ed6f57e1c550ed5a83ac08dc24ec5c` in
[canonical run 39693531514, attempt 1](https://github.com/Optidigi/siteinabox/actions/runs/39693531514).
Its parents are main `0aeb9566` and reviewed M15 PR head `ca12add3`. All eight
underlying jobs passed, including 344 CMS test files, the 19-assertion actual
built-browser journey and all three packaged images. The aggregate correctly
rejected prior local helper hashes. These baseline identities do not replace
fresh final-policy-head source/run/artifact verification.

M15 preserves the frozen graph and binds its eight CMS helper bundles to actual
hosted bytes. The documented `node apps/cms/scripts/build-runtime-bundle.mjs`
command must run from the repository root, as Docker does. The earlier local
invocation ran from `apps/cms`; esbuild embedded different source paths and
identifiers. Root generation and a separate frozen filtered build now reproduce
all eight hosted sizes/hashes exactly. Populated old/new boot rehearsals preserve
credentials, outstanding links, verification history and uncertain delivery;
final policy-head hosted matching remains required.
Fresh source review sees only Composer security-fix additions in the Alpine
community data; none of the five retained image inventories ships Composer.
Better Auth 1.7.12, Node 24.22.1, scanner security-patch qualification and the
Alpine musl vendor fix remain unresolved blockers. Release-age
recheck deadlines, the original global review expiry and all advisory/native
blockers remain in force. No metadata refresh qualifies exploitability,
publisher support or a compatible remediation.

| Image role | Package records | Vulnerability records | Native files | Bundled scripts |
| --- | ---: | ---: | ---: | ---: |
| CMS | 255 | 73 | 80 | 8 |
| Renderer | 650 | 13 | 43 | 0 |
| Site | 72 | 8 | 127 | 0 |
| PostgreSQL | 57 | 63 | 260 | 0 |
| Cloudflared | 79 | 40 | 281 | 0 |

There are 198 reviewed image dispositions, including the unversioned esbuild
module, plus five blocked native assessments. Every image disposition remains
release-blocking. Current primary facts include Go advisory bodies, GitHub
package advisories and Alpine vendor data. Two GitHub OS records contain only
advisory metadata without structured package ranges; source-less DSA-6572-1 and
other incomplete primary/support facts remain explicit analysis gaps. Review
ownership, affected surfaces, recheck conditions and the unchanged global expiry
are recorded in the policy JSON.

Compatible Vitest/Vite patches remove their known findings; full/production
workspace audits retain braces, with selector-parser also in the full graph.
Image evidence additionally identifies vulnerable global npm packages, OS
libraries and Go runtimes. Critical CVE-2025-68121 is reported in the CMS's shipped
esbuild runtime (Go 1.23.12) and PostgreSQL's gosu helper (Go 1.24.6). The current
cloudflared inventory confirms Go 1.27.2 and
[GO-2026-6809 / CVE-2026-111943](https://pkg.go.dev/vuln/GO-2026-6809).
These are affected-package findings; actual deployment exploitability is
unproven. Full `sharp.versions` and native hashes are retained, but universal
opaque-binary advisory coverage and publisher-support qualification remain
incomplete. All these uncertainties continue to block release.

No clean-security, live-provider, production/Amicare preservation, recovery,
publication or rollout gate is closed. Historical M11 diagnostics remain
historical. Before release, remediate or obtain separately authorized risk
constraints, refresh primary facts and verify the exact candidate bytes again.
