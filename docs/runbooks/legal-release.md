# Legal Release Runbook

## Preparing A Release

For the governed product bundle, source completion is allowed while legal facts
remain unresolved. The checked-in M17 bundle is explicitly a non-public draft;
engineering review/merge does not constitute owner legal review or activation.
The following legacy release procedure does not publish that product bundle.

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

## Product Bundle Review And Activation

1. Complete actual issuer/controller/provider and retention facts, lifecycle proof,
   translation review and owner decisions about materiality, audience and notice.
   Resolve every source blocker in a separately reviewed version; never invent
   facts or remove markers solely to enable a button.
2. Verify the exact source bundle/hash and all NL/EN terms/privacy text using the
   owning legal checks and rendered journeys. Keep legacy landing bytes unchanged.
3. Obtain scoped owner legal approval. In `/legal/product-drafts/[key]`, a genuine
   platform operator records its reference, ISO dates with timezone and explicit
   existing tenant IDs. An empty audience targets no existing tenants.
4. Obtain separate publication authorization for that exact bundle and environment.
   Activate through the same operator surface; deployment/synchronization alone
   does not do this. No production or provider operation follows automatically.
5. Read back the public product manifest and permanent NL/EN routes, verify hashes,
   publication/effective boundaries and checkout statement versions. Reconcile
   audience requirements/notices and separately approved consent renewal; check
   retry identity and historical acceptance/order preservation.

Registration can be retried after a partial failure; the final review and activation
anchors prevent partial copies becoming public. Notification failures remain
retryable after publication. Immutable legal records cannot be rolled back by
editing their content or deleting acceptances. On a release fault, fail closed and
prepare a new reviewed corrective version and any separately approved operational
containment; reverting application source is not a revocation of recorded approval.

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
