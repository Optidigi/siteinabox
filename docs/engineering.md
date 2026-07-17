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
