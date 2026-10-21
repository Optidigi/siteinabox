# Current dependency evidence

`dependency-security.json` owns reviewed conditional dispositions, publisher
facts, graph/configuration identities, review ownership and expiry. It is not a
blanket acceptance of risk. The October 7 candidate reviewed until October 14 is
historical; its dates and findings were not copied forward as current evidence.

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
an audit database omits a notice. Public publisher metadata is fetched without
authentication, so organization IP restrictions on workflow tokens do not apply.
Unavailable or rate-limited metadata still fails closed; no provider credential
or new application startup variable is needed.

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
result. Completed image smoke tests do not clear native advisory uncertainty.

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

The compatible Vitest 4.1.12 and CMS Vite 8.3.4 patches remove the known mocker and
older Vite findings. Full audit still includes the Payload-private braces high
finding and typography's selector-parser moderate finding; production audit
includes braces. The retained historical M11 CMS archive also reveals OS and
bundled npm/Go findings absent from `pnpm audit`, including a scanner-critical Go
standard-library finding in an esbuild binary. Presence does not establish an
exploitable deployment condition or what production currently runs.

Current-candidate native assessments must be completed from hosted artifacts
before this milestone's inventory is qualified. Missing native records are
intentional blockers during qualification, not a clean or completed release
claim. No real provider evaluation, production/Amicare preservation, recovery,
publication or rollout gate is closed here. Review/remediate actual remaining
findings and repeat affected evidence before seeking those approvals.
