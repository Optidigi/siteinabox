# Engineering workflow

Use the highest risk level triggered by a change; diff size does not lower risk.

## Evidence

| Label | Meaning |
| --- | --- |
| Observed fact | Direct evidence from source, configuration, logs, or an authoritative source |
| Confirmed defect | Reproduced wrong behavior or direct conflict with an invariant |
| Risk | Credible failure or exposure not proven to have occurred |
| Intentional / accepted | Deliberately retained behavior or constraint |
| Unknown | Evidence is insufficient or inaccessible |
| Recommendation | Proposed future action |
| Historical / closed | No longer current |

Material findings include evidence, confidence, affected scope, and next action.

## Risk

| Level | Typical triggers | Required handling |
| --- | --- | --- |
| Routine | Bounded, understood, reversible; no security, data, contract, release, legal/privacy, or compatibility concern | Implement directly, focused checks, self-review |
| Significant | Several modules, uncertain cause, contract/concurrency/generated surface, broad visual or compatibility effect | Short plan, isolated worktree when useful, focused and broader checks, fresh review across risk boundaries |
| High | Authentication/authorization, secrets, migrations/data integrity, destructive work, deployment/release, external writes, legal/privacy, uncertain compatibility removal | Plan with invariants, tests, rollback and approvals; isolated worktree; production-equivalent rehearsal where possible; independent review |

## Proportional verification and release

Verification follows the changed surface as well as its risk. Start narrow and
expand only when a wider check can catch a plausible regression introduced by
the diff.

| Change surface | Expected verification | Release handling |
| --- | --- | --- |
| Documentation or agent instructions only | Link/structure checks, diff check, self-review | No application build, image publication, or deployment |
| Tests only | The changed test and its owning package/job | No deployment unless runtime packaging or release behavior changed |
| One application runtime | Focused regression, owning package checks, production build | Build and deploy only the affected image when approved |
| Shared runtime contract, workspace dependency, lockfile, generator, or release workflow | Focused checks plus every demonstrated consumer/release path | Build affected consumers; rehearse the relevant release boundary |
| Authentication, authorization, data/schema, legal/privacy behavior, or production operation | Focused checks plus the High-risk evidence required above | Use explicit approval, rollback, and production-equivalent verification |

Practical stopping rules:

- Do not rerun the full repository merely because a narrow check passed; require
  a shared dependency, contract, generated artifact, or risk boundary that makes
  broader verification relevant.
- A broadly triggered hosted workflow may continue as repository policy, but it
  does not expand the implementation or deployment scope. Wait for the jobs
  required to support the handoff claim and report unrelated jobs separately.
- One well-instrumented production smoke is preferable to repeated probes. A
  failed probe is evidence about the system only after the harness itself is
  ruled out.
- Production is in sync when it runs the latest deploy-relevant content.
  Documentation, instructions, and non-packaged tests can be ahead of the image
  revision without requiring a no-op rebuild or redeploy.

## Flow

1. Record branch, exact SHA, and dirty state; protect unrelated work.
2. Read the applicable current sources and identify owners, callers, data flow,
   contracts, tests, and release path.
3. Reproduce the problem where feasible, classify it, and select risk.
4. Use one implementation owner. Split only independent, bounded research or
   review work.
5. Make the smallest coherent change. Avoid new sources of truth and do not
   remove compatibility behavior without consumer evidence.
6. Verify in expanding rings: focused regression, changed package/app, broader
   CI-equivalent checks, then release/migration/browser/visual/legal checks when
   applicable.
7. Review scope, secrets, generated files, compatibility, data/access rules,
   release effects, documentation, and rollback.
8. Hand off exact commands/results, commits/files, skipped evidence, unresolved
   assumptions, and operator actions.

Owner input is required for product/security/privacy policy, credentials,
destructive removal, production/provider writes, unresolved consumers, and
material release or rollback decisions. Do not weaken a control to make a
change pass.
