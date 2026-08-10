# Environment inventory

`docs/environment-inventory.json` is the source-read inventory for the four
deployable applications. `pnpm environment:check` compares it with tracked
application source and fails when an environment read is added or removed
without an inventory update.

| Application | Source-read names | Classification status |
| --- | ---: | --- |
| CMS | 76 | Owner review required |
| Intake | 4 | Owner review required |
| Landing | 6 | Owner review required |
| Renderer | 13 | Owner review required |

This first boundary deliberately records names without guessing whether a value
is build-time or runtime, public or secret, required or optional, validated or
unvalidated, or current or deprecated. Those classifications affect auth,
tenancy, providers, legal/privacy behavior, renderer access, and deployment, so
each application contract needs owner and deployment evidence before it can
enforce requirements.

The inventory includes names read by application source and tests. It does not
copy values from local or production environment files and never prints them.
Dockerfiles, Compose declarations, workflows, examples, and runbooks remain
separate consumers to be reconciled by the subsequent per-application contract
PRs.

## Planned follow-up boundaries

1. Classify the CMS names and add validation without changing existing reads.
2. Classify the renderer token/file and fixture boundaries.
3. Classify the public build-time settings for landing and intake.
4. Reconcile examples, Compose, workflows, Docker build arguments, and runbooks.

Until those reviews are complete, `owner-review-required` is an intentional
guard against treating an incomplete inventory as a security or deployment
contract.
