# Legal Release Runbook

## Preparing A Release

1. Create a new immutable Markdown version under `packages/legal-content`.
2. Add release metadata with the previous version, effective time, change
   summary, category, customer action, consent action, and audience.
3. Record the review rationale. Do not use a diff as a materiality decision.
4. Run the repository legal validation and relevant application tests.
5. Obtain the required legal/product review before merge.

## Release Safety

- Never modify or delete an already published version.
- Never fabricate an acceptance for a pre-existing customer.
- Never mark privacy disclosure as consent to necessary contract processing.
- Never create a Mollie checkout until the order, approval, and terms
  acceptance reference the same current release state.
- Never activate a release when the public version hash differs from Payload.
- Correct an incorrect release with a new version.

## Deployment Verification

- The current and permanent public routes return successfully.
- The well-known manifest contains the expected version and SHA-256 hash.
- Payload contains exactly one immutable record for the version and hash.
- The effective document resolver returns the expected version at the boundary
  before and after `effectiveAt`.
- The publication event records the actor or deployment revision.
- Required notification or acceptance jobs exist for the selected audience.
- Failures appear in operational alerts and retry according to job policy.

The landing app is static. Deploy it at or after `publishedAt` to expose the
permanent route, and deploy it again at or after `effectiveAt` when a scheduled
release must become the stable current route. Deploy CMS only after the public
manifest contains the release. Future permanent routes are excluded from the
landing build until `publishedAt`.

## Customer Actions

| Action | Result |
| --- | --- |
| `none` | Publish only; existing acceptance remains valid. |
| `publish_notice` | Show a non-blocking account notice. |
| `direct_notice` | Queue direct notice and record delivery attempts. |
| `reaccept_on_next_transaction` | Require the new acceptance at renewal, upgrade, or add-on purchase. |
| `mandatory_reaccept` | Create a dated account requirement for the affected audience. |

Consent renewal is scoped independently to analytics, marketing, or all
optional categories. Necessary processing is never disabled by an optional
consent withdrawal.

## Initial Adoption

The initial legal package is recorded as the first reviewed SIAB release.
Existing paid customers without system evidence must be handled through an
explicit adoption decision and customer communication. The migration must not
backfill acceptance timestamps or claims that cannot be demonstrated.
