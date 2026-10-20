# Protected delivery

Own each PR through independent Standards and Spec reviews, resolve findings at
the exact final head, and merge normally after all required checks pass. Agent
reviews are engineering evidence. Honor any configured GitHub human approval
requirements with actual identities; agent reports do not satisfy them.

## Required CI

`docs/verification-matrix.json` owns command coverage; `ci.yml` executes it.
`required-ci` depends on every canonical job and the complete image matrix.
Every PR receives actual unpublished builds and startup checks for CMS,
renderer and landing, including shared contracts, renderer, UI and legal inputs.
Failures, cancellation, missing results and skipped requirements fail the
aggregate. All three image records must match the tested source and current
run/attempt. `required-ci-evidence` retains results and image identities for
seven days; preserve them in the approved release record before expiry.

PR evidence distinguishes the tested merge commit from the PR head. Main
publication checks require successful canonical jobs at the exact requested
main source, including all three matrix contexts and the aggregate. Standalone
image workflows retain archives for approved promotion without rebuilding;
the CI matrix retains small verification records. Neither run publishes images.

## Protection proposal and diagnostic

`ops/github/main-ruleset.json` is an installation proposal, not live protection.
It targets main, requires PRs, resolved conversations and strict current-base
checks, blocks deletion and force pushes, and has an explicitly empty bypass
list. Required contexts are the five canonical jobs plus `required-ci`, bound
to GitHub Actions app ID 15368 observed on actual repository checks. The
aggregate includes every image variant. Zero mandatory GitHub approvals avoids
inventing an additional human approver; independent agent reviews remain
required engineering evidence. Existing human review settings still apply until
an explicitly approved settings change.

Run the read-only diagnostic using existing user-scope GitHub authentication:

```bash
GITHUB_REPOSITORY=Optidigi/siteinabox pnpm delivery:inspect
```

It records ruleset inventory/details, effective main rules, legacy protection,
Actions containment and publication environment/branch policies under ignored
`artifacts/delivery-control-readback.json`. It compares requested proposal fields
while accepting additive server metadata. Missing, differing and unreadable
controls are distinct. A hidden bypass list is unknown. A 404 may mean hidden
access; it is not proof of absence. Canonical CI runs this same diagnostic with
its actual workflow token, which may be unable to read administrative controls.
Unknown diagnostic fields do not make CI tests fail or claim controls passed.
API responses are diagnostic evidence, not approval or enforcement proof.

The [GitHub rules API](https://docs.github.com/en/rest/repos/rules) defines the
proposal fields and source-bound required contexts. The
[workflow job dependency contract](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idneeds)
explains why the aggregate uses `always()` and explicitly checks dependency
results instead of inheriting a success-only condition.

## Separately approved installation and release

Before subsequent runtime-changing merges, complete the installed-control gate:
read current controls, prepare the exact payload/target/source identities and
proposed differences, obtain scoped owner approval, install, read back effective
policy and prove enforcement safely. Use a separately approved disposable
branch/PR for failed-check/direct-update/force/delete evidence; never probe
force pushes or deletion on main. Preserve any stronger existing controls and
actual human-review requirements. Installing/updating settings, creating control
fixtures and removing their rulesets require concrete approval; this code does
none of those operations. Administrative rollback needs its own approved exact
operation. A Git revert does not revert live settings.

G01 Actions containment remains a separate installed control. Read it back and
check publisher queues before relevant merges. Keep historical Docker publisher
actions excluded. Environment reviewer/branch/bypass controls need their own
installed readback; an omitted bypass API field requires explicit UI evidence.
The existing publication guard still requires a real configured reviewer's
approval for the exact fresh run. See [image publication](image-publication.md)
for that separately approved operation. Source completion authorizes neither
registry publication, deployment nor provider writes. Keep those gates blocked
when required approval, control or exact-source evidence is missing.
