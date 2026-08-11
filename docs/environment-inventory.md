# Environment inventory

`docs/environment-inventory.json` is the source-read inventory for the four
deployable applications. `pnpm environment:check` compares it with tracked
application source and fails when an environment read is added or removed
without an inventory update.

| Application | Source-read names | Classification status |
| --- | ---: | --- |
| CMS | 76 | Researched contract |
| Intake | 4 | Researched contract |
| Landing | 7 | Researched contract |
| Renderer | 13 | Researched contract |

The inventory now has a non-mutating classification contract in
`docs/environment-contracts.md`. It distinguishes build/runtime/test phase,
public/secret/internal exposure, and startup-required/operation-scoped/optional
requiredness. Source evidence proves CMS startup requirements for
`PAYLOAD_SECRET` and `DATABASE_URI`; other provider and security variables are
classified by operation scope rather than inferred as universal startup
requirements.

The inventory includes names read by application source and tests. It does not
copy values from local or production environment files and never prints them.
Dockerfiles, Compose declarations, workflows, examples, and runbooks remain
separate consumers to be reconciled by the subsequent per-application contract
PRs.

## Remaining evidence boundaries

1. Reconcile the classified source inventory with future deployment changes.
2. Add runtime validation only for requirements proven by an application contract
   and a compatibility-tested rollout.
3. Keep provider, legal, tenancy, commerce, and renderer operation checks at
   their existing call sites.

The CI contract check is intentionally non-mutating: it never reads or prints
VPS values and does not change application startup behavior.
