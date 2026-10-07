# Protected delivery

The integration owner submits one PR and stops for independent architect review.
GitHub review identities and environment approval are real provider controls;
local agent reviews supply evidence and never impersonate those identities.

## Main policy

`ops/github/main-ruleset.json` is the reviewed installation proposal. It requires
PRs, one non-author approval, dismissal of stale approvals, approval after the
last push, resolved conversations, strict current-base checks, no deletion or
force push, and zero standing bypass actors. The five stable canonical job
contexts plus `required-ci` are bound to the observed GitHub Actions app.
The summary rejects skipped, cancelled and missing canonical jobs, including
all packaged-image variants.

Administrative configuration is outside Git: changing this file does not install
a ruleset. Obtain explicit owner authorization immediately before the write.
Read the existing rulesets and active main rules first, prepare the exact diff,
and rehearse the same proposed policy on an explicitly disposable target branch.
Create the target before activating its ruleset. Intentionally fail an actual
Actions-source required context; an independently operated write-capable reviewer
approves the unchanged fixture head before the normal merge attempt. The
rejection must identify the failed check, with the target SHA unchanged. A
missing approval, conflict or wrong-SHA rejection proves a different gate.

Test direct update, non-fast-forward update and deletion only on that disposable
target with the actual administrator absent from bypass. Fixture check statuses
are control-test evidence, never application verification. If a write unexpectedly
succeeds, record the failed control and stop. Obtain separate immediate
authorization to remove the exact temporary ruleset for cleanup. Preserve all
other branches and settings.

After the proof and immediate owner authorization, install the proposal:

```bash
gh api --method POST repos/Optidigi/siteinabox/rulesets \
  --input ops/github/main-ruleset.json
```

If an existing policy owns main, prepare an update to its observed ID instead of
creating a competing rule blindly. Retain the response, rule ID, effective-rule
readback, actor/permission evidence and proposal hash in the operational packet.
Compare the requested fields while allowing documented server defaults; verify
the bypass list is empty and the administrator's effective bypass is `never`.
Administrators can still edit the policy itself, so record settings/history
readback after administrative changes. This is a trust boundary, not an immutable
rule. Owner-approved emergency changes remain explicit and observable.

## Image publication boundary

Image workflows run only on main and use `ghcr-publish`. Their default token is
read-only; package-write permission is limited to the gated job. Before registry
login or build/push they require the active main policy, exact-source successful
canonical CI, fresh dependency release disposition, and an actual independent
approval of that publication run. Checks/builds can run on PRs without package
publication or environment/provider secrets.

The owner designates an independently operated user with the required repository
access. Obtain immediate authorization before each environment administration
write. Configure `ghcr-publish` with that required reviewer, prevent-self-review,
and custom branch policies containing exactly `main` as a branch and no tags.
Read back the complete reviewer and branch policy lists. In repository Settings
→ Environments → ghcr-publish, disable administrator bypass with separately
authorized UI action and retain safe evidence. The inspected public REST/GraphQL
API exposes no setter/getter for that flag; absence is unknown, never proof of
disablement. UI evidence remains a release-control gate.

The publication guard also rejects a bypass without explicit approval by a
configured reviewer different from the initiating actor. Public approval history
has no run-attempt discriminator: use a fresh workflow dispatch on main to retry
publication. Re-running an old run, missing/ambiguous approval history, changed
policy, unknown CI evidence, or a new unreviewed advisory fails closed. Team-only
reviewers are unsupported by this guard until actual membership evidence is
implemented; designate an approved individual rather than weakening it.

Existing post-publication image smoke remains an additional check. CI records
the built/smoked source SHA and local image ID; these are not deployed-image
digests. Publication approval does not authorize VPS rollout, paid canaries,
credential rotation or provider mutations. Deployment still binds separate
approval to the actual verified digest and configuration.

## Evidence and rollback

The review packet includes exact base/head, complete changed-file inventory,
fresh advisory disposition, all canonical commands/results, image evidence,
separate Standards/Spec findings, actual rule readback/rejection responses and
unavailable controls. Settings proposals and local green checks are not installation
or merge authorization. Preserve skipped/unavailable evidence as release gates.

Roll back manifests, lockfile, runtime/image declarations and affected CI together
only to a reviewed compatible graph with acceptable security. A known vulnerable
previous graph is not a durable rollback target. No schema rollback is implied
by a toolchain rollback. The Payload security compatibility migration adds a
nullable cooldown timestamp; keep that additive column when rolling application
code back to a reviewed compatible security-safe version. Its generated down
migration removes cooldown timestamps and must never run while the selected
Payload version requires the field. Rehearse any separately authorized database
recovery on a disposable prior state first. Git reverts do not remove external rules/environment
configuration; prepare any administrative rollback separately and obtain owner
authorization immediately before it. Keep publication/deployment blocked while
required checks, independent approval or control evidence are unavailable.
