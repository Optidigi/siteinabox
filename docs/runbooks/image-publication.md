# Image verification and approved publication

Ordinary pull requests, matching main pushes and manual verification runs build
and smoke-test images without publishing to a registry. The three
`build-*-image.yml` workflows use read-only permissions, no registry login and no
registry cache exports. `pnpm publication:check` protects this boundary and tests
the publication admission policy. The canonical CI image matrix and
`required-ci` remain required evidence; see
[protected delivery](protected-delivery.md).

## Verify

With the repository Node/pnpm toolchain and a local Docker engine, commit the
source and run `pnpm image:verify cms`, `pnpm image:verify renderer` or
`pnpm image:verify site`. The command rejects dirty source. It creates only its
uniquely named containers/network and temporary database/media, then cleans them
up. It never connects to application provider accounts. CMS jobs are disabled
and AI uses mocks; the renderer uses its existing deterministic host-routing
harness. The landing image runs its actual Nginx health contract.

Each successful run writes an archive and JSON evidence under ignored
`artifacts/`: full source SHA, local image ID, archive SHA-256, smoke result and
workflow run/attempt. Hosted image workflows retain these as immutable Actions
artifacts for seven days. Download and preserve release evidence through the
approved release/rollback record; expiring artifacts are not durable release
evidence. Reverify if an archive expires.

Landing verification accepts a synthetic analytics project token when the
public build token is unavailable (for example, fork PRs). Its evidence is then
marked unpublishable. A publishable landing archive must have been built with
the configured public `POSTHOG_PROJECT_TOKEN`; runtime provider keys never enter
the image. Changing a build input requires a fresh verified archive.

## Publish one reviewed artifact

Prepare the exact source SHA, image, successful main verification run ID,
archive SHA-256 and local image ID for owner approval. Verify canonical CI at
that source, dependency/security disposition and applicable release gates.
Publication does not authorize deployment or provider operations.

Dispatch `publish-image.yml` **on main** with `image` (`cms`, `renderer` or
`site`), `source_sha` (40 hexadecimal characters) and `verification_run_id`.
The run name displays the source/image/run being approved. The protected
`ghcr-publish` environment must have configured user reviewers, main-only custom
branch policies and administrator bypass disabled. The owner may be the same
person who dispatched the run; no additional human publisher is imposed.
If the API omits the bypass-setting field, verify that setting in the environment
UI as part of the installed-control gate; its absence is not proof that bypass
is disabled. The guard independently requires an actual reviewer decision and
rejects an explicitly enabled bypass setting whenever returned by the API.

The guard rejects automatic events, branches other than main and every retry.
It reads installed environment rules and the run's single explicit reviewer
decision; an administrator bypass or historical decision is insufficient. It
requires a main ancestor source, a successful main image verification run and
every canonical CI job, all three image variants and `required-ci` at that exact SHA. Missing, failed, cancelled or skipped
work blocks publication. Archive bytes, source, image and verification attempt
must match the evidence. Inputs never select executable checkout code: the
publication policy is checked out from the trusted main workflow revision.

After approval, the workflow loads the verified archive, checks its image ID and
pushes only `ghcr.io/optidigi/siteinabox-<image>:sha-<full-source-sha>`. It does
not rebuild, update `latest`, export registry caches or deploy. The output
`published-<image>.json` records the immutable registry digest and publication run
and is retained for 90 days. Bind deployment approval to this digest. Partial
registry success is a release exception: inspect existing tags/digests read-only,
then obtain a fresh exact-operation approval before a new dispatch. Never rerun
an approved publication attempt or delete a published artifact as routine cleanup.

## Bootstrap and installed controls

Source policy is not evidence of installed protection. Before the first
publication-affecting merge, inventory all active/queued/waiting publishers and
historical reruns. Old workflow definitions can still publish. Prepare any
necessary live containment for explicit owner approval: stop new invocations of
the three old publishers, cancel pending old runs and prevent historical retries
from obtaining package-write credentials. Do not assume this PR cancels old runs.
Do not disable canonical CI or weaken any existing required check/review.

For the baseline publishers, all registry paths use Docker setup/login/build
actions. A repository Actions allowlist permitting GitHub-owned actions and
`pnpm/action-setup@*`, with other verified creators disabled, blocks these old
definitions (including historical retries) while preserving canonical CI and
the new Docker-CLI verification/publication paths. Inventory and cancel existing
pending publishers first, because a policy change cannot undo a running push.
Read back effective settings after the approved operation and recheck the queue
before merging. Keep the Docker actions excluded after bootstrap; adding them
back would reopen historical publisher paths. This policy is a live control
proposal until separately approved and installed. Preserve running Amicare
images, container configuration, data, domains and access throughout.
