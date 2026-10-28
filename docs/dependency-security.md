# Current dependency evidence

`dependency-security.json` owns reviewed conditional dispositions, publisher
facts, graph/configuration identities, review ownership and expiry. It is not a
blanket acceptance of risk. The October 7 candidate reviewed until October 14 is
historical; its dates and findings were not copied forward as current evidence.

## Six-image blocked inventory review

The release-completion candidate `fc398e37` has exact-source manual packaged
receipts for CMS, renderer, site, owned PostgreSQL and Exchange worker, plus
pinned cloudflared. The proposed structured review records 64 image review rows:
63 scanner findings and the worker's explicit mapping-gap row. Both full and
production source audits retain Payload/deepmerge 4.3.1. All six native
assessments and seven unresolved deferrals remain release-blocking; the separate
supported-release Vitest deferral retains its classification.

This is a substantive inventory review after the prior October 28 expiry:
130 primary facts include 122 unchanged facts, two reconciled feed updates and
six added advisory facts. Old vendor PostgreSQL rows are replaced by the scanned
owned image because source production Compose now requires its approved digest;
the vendor baseline remains only a build/rehearsal input. No deployed database
or service has changed. Eight retained finding identities change references
only; all retained paths, versions, selected severities and fixes remain bound.

Actual musl 1.2.6-r3, BIND 9.20.30-r0 and Brotli 1.2.1-r0 candidate versions are
recorded without claiming complete native qualification. The worker retains
EXO's Pkcs 10.0.0 alongside PowerShell's 10.0.14, all duplicate/alternate-platform
files and all 14 mapping-gap paths. Windows-only advisory scope is distinguished
from Linux-relevant affected-version evidence. Cloudflared retains OpenPGP,
x/net HTML, go-jose and Debian/provenance blockers.

`dependency-security.json` owns the review window and exact identities. The
fresh window is backed by source/publisher/image evidence and independent review,
not a timestamp-only extension. Manual baseline receipts never substitute for
final-source hosted CI, approval, publication or deployment. Inventory validation
can pass while release validation must reject these findings and assessments.

The [release-completion spec](https://github.com/Optidigi/siteinabox/issues/132)
owns acceptance criteria; [protected delivery](runbooks/protected-delivery.md)
and [image publication](runbooks/image-publication.md) own operating procedures.
The [deepmerge ticket](https://github.com/Optidigi/siteinabox/issues/140) retains
its primary-source investigation and unsupported-fix blocker.

## Historical qualification receipts

The sections below retain the context of earlier candidates. Counts, dates and
qualification statements apply to those candidates, not the current release.

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

## Canonical CI input qualification

The CI-efficiency follow-up rebinds the reviewed graph/configuration identities
without changing workspace package versions or production image bases. The
current Alpine publisher delta adds Ruby3.4.12-r0 fixes; Ruby is absent from all
five retained production package inventories. All13 source dispositions,287
image dispositions, five blocked native assessments, seven deferrals and the
original October28 expiry are preserved. Digest-pinned CI-only Playwright and
BuildKit images and the cache Action remain infrastructure inputs requiring
actual hosted verification; they do not clear production release gates.

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

## October 27 deployment preparation

The Alpine community publisher feed added `mongo-c-driver` 1.30.14 security
fixes. The package and its `libmongoc`/`libbson` names are absent from all five
retained raw production image package inventories from canonical run
40487060728. This reconciles that publisher fact after reviewing the primary
feed delta; it does not establish final-candidate release clearance. All 13
source findings, 287 image findings, five blocked native assessments, seven
deferrals and the original October 28 expiry remain unchanged.

The PR128 image inventory refresh retains the same 287 finding identities,
package versions, paths and all five native fingerprints. Current scanner
metadata changes 107 finding fact hashes (references, vendor labels and modified
dates). Three existing Go CVE-2026-111943 findings in CMS, PostgreSQL and
cloudflared rise from moderate to high in scanner-selected severity. The retained
primary Go advisory GO-2026-6809 still identifies affected versions below
1.26.10 and 1.27.3 for the respective branches. All dispositions remain blocked;
no finding, native assessment, deferral or expiry is waived. Evidence comes from
canonical run 40506626773, with the detailed comparison retained separately.

## Bounded release-patch candidate

The candidate replaces affected source versions with Zod 4.6.7, happy-dom 21.0.4,
fast-uri 3.1.9 and postcss-selector-parser 6.1.5. Overrides are scoped to their
actual consumers; the Astro sitemap's older Zod copy is patched as well. Fresh
full and production npm audits each contain zero findings, so the 13 obsolete
source dispositions are removed after the package changes and current audit
agreement. Their primary advisory facts remain retained.

Better Auth moves to the age-eligible 1.7.12 security patch. The governed Node
runtime and application build/run stages move to the reviewed 24.22.1 LTS image.
PostgreSQL remains 18.6 using a rebuilt publisher image; Nginx becomes 1.31.8 and
cloudflared 2026.10.4. Publisher index/config identities and the cloudflared binary
digest were verified; these candidates exceed the 24-hour age floor. These are
scan/qualification candidates, not clean-image claims.

Global npm/npx and Yarn are removed only from CMS/renderer runtime stages; their
builders retain package tooling. Startup and generated operator helpers use
direct Node. Packaged verification now rejects runtime package-manager binaries.
Native helpers, esbuild, Sharp/libvips/PDF and gosu are not removed by assumption.
The exact candidate image/native inventories and helper behavior remain required.

Local qualification passes contracts/schema tests, the real migrated-database
Better Auth SDK/schema/invitation tests, social/passwordless/session tests and
rich-text tests. A required headless DOM contract covers Lexical HTML
import/export and restoration of ambient globals with happy-dom 21. The actual
Node runtime rejects an untrusted synthetic certificate and validates Microsoft
public OIDC HTTPS without credentials. This does not prove partner permissions.

All five native assessments and the unresolved release deferrals remain blocked.
Their reasons now distinguish the candidate patch from outstanding exact-image
qualification. The 287 historical image dispositions remain until fresh candidate
images are reviewed; no native clearance or scanner-gap waiver is inferred from
audit success. The original October 28 expiry remains unchanged.

Image verification now consumes the same run's freshly collected scanner release
and selected archive/checksum asset digests from package quality. The fact digest
is checked against trusted source policy; source/run/attempt, configuration/graph
identity and collection age are checked before use. Release age, downloaded-byte
hashes and advisory database refresh remain enforced by scanner preparation.
Invalid receipts fail closed. This avoids redundant GitHub public metadata reads
that hit shared-runner anonymous quotas and authenticated organization IP rules.
Standalone operations retain the live primary-read path when no receipt exists.

The first patched image reports reduce enumerated findings from 287 to 222 with
no new finding identities. Their zero-finding renderer result is not native
clearance: the shipped esbuild 0.28.2 ELF lacks Go build-info metadata but retains
Go PC-table, runtime-main and Go 1.26.5 signals. Independent native inventory now
recognizes that combination and requires scanner coverage, retaining an explicit
analysis blocker when coverage is absent. Native assessments remain blocked.
The landing image additionally pins the age-eligible Alpine brotli-libs 1.2.1-r0
and curl/libcurl 8.23.0-r0 fixes; an isolated container verifies those upgrades
preserve Nginx 1.31.8. Fresh final-source image reports remain mandatory.

## Exact candidate image reconciliation

Canonical run 40530772192 passes every source, browser, worker and packaged-image
build/startup check. Retained raw image inventories contain 174 findings versus
287 before remediation: 114 obsolete identities disappear after actual package
changes/removals; one explicit renderer Go-analysis gap is added. Ninety-four
retained rows have current scanner metadata changes. No unresolved finding is
waived. The landing image now has zero enumerated findings after its three
pinned library fixes; that result alone is not full native qualification.

All five changed native fingerprints remain blocked and are bound to the exact
source/image/archive/report/native-inventory identities. The eight actual CMS
runtime helper hashes and sizes match the owning root generator with Node
24.22.1. Renderer analysis now explicitly includes its stripped Go target and
missing scanner coverage. CMS's esbuild/unversioned component, PostgreSQL's gosu
and OS findings, and cloudflared's dependency/provenance findings remain blockers.
All seven unresolved deferrals and the original October 28 expiry are retained.
Fresh final-source CI remains necessary after this evidence update.

## Owned compiler exact-image reconciliation

Canonical run 40551470220 passes all source, browser, worker and four consuming
image build/startup checks. The current raw inventories contain 112 findings:
62 previous identities disappear after the owned esbuild rebuilds replace every
runtime native copy and restore complete reported Go target coverage. No new or
changed finding identities remain. CMS, renderer and landing each enumerate zero
findings with no unversioned components or reported analysis gaps; PostgreSQL has
86 and cloudflared 26. This is inventory evidence, not blanket release clearance.

All five native assessments remain blocked. Changed CMS/renderer fingerprints
bind actual rebuilt binaries, source VCS/dependency metadata and exact images;
the eight CMS helper hashes and sizes remain identical to the owning generator.
All seven deferrals and the October 28 expiry remain unchanged. The owned
PostgreSQL candidate, Cloudflare issues, complete worker security qualification
and publication integration remain outstanding. Fresh final-source CI is required.
