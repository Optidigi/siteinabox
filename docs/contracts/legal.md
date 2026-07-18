# Legal Document Governance

## Decision

Site in a Box is a trade name of Optidigi. Optidigi is the contracting legal
entity and controller or processor identified in the platform legal documents.
Public product surfaces may lead with the Site in a Box trade name, but must not
describe it as a separate legal entity.

Legal content uses three connected sources of truth:

| Concern | Source of truth |
| --- | --- |
| Authored text, review, and change classification | Immutable files in `packages/legal-content` |
| Published and effective document state | Payload legal collections |
| Customer notices, approvals, preferences, and acceptance evidence | Append-only Payload records |

Git records authorship and review. Payload controls effective dates and runtime
requirements. An acceptance always references an immutable document hash and
the exact version of the statement presented to the actor.

## Version Model

- `documentVersion` changes for every published text change.
- `acceptanceVersion` changes only when a contractual change requires new
  acceptance.
- `consentVersion` changes when an analytics or marketing consent scope changes.
- `statementVersion` identifies the exact checkbox or confirmation wording.
- `contentHash` is the SHA-256 hash of canonical document content.
- `effectiveAt` determines when a release becomes authoritative.

Versions use `YYYY-MM-DD.revision`. Published source files are never edited or
deleted. A correction creates a new document version and normally retains the
same acceptance version.

## Change Classification

Every release declares one category and the customer/consent action selected by
the approved policy matrix. Classification is a legal and product decision; it
must not be inferred from a textual diff.

| Category | Allowed customer action |
| --- | --- |
| `editorial` | `none` |
| `non_material_clarification` | `none`, `publish_notice` |
| `administrative` | `none`, `publish_notice`, `direct_notice` |
| `service_operational` | `publish_notice`, `direct_notice` |
| `subprocessor_change` | `direct_notice` |
| `privacy_transparency` | `none`, `publish_notice` |
| `privacy_material` | `direct_notice` plus an optional scoped consent renewal |
| `contract_material` | `reaccept_on_next_transaction`, `mandatory_reaccept` |
| `customer_adverse` | `mandatory_reaccept` |
| `consent_scope_change` | notice plus scoped consent renewal |

CI and the deployment sync command reject inconsistent releases. A release that
requires re-acceptance must introduce a new acceptance version. An editorial
release must preserve it. Mandatory re-acceptance requires an effective date,
an audience, and an enforcement policy.

## Publication And Deployment

The public landing image contains current and historical legal routes plus a
machine-readable hash manifest. CMS legal synchronization is idempotent and may
only activate a release after the permanent public route exposes the expected
hash.

Deployment order:

1. Apply database migrations.
2. Deploy landing and its immutable legal pages.
3. Verify the public legal manifest and version-route hash.
4. Deploy CMS and run the legal synchronization command.
5. Activate immediately or schedule activation at `effectiveAt`.
6. Create notices, consent renewals, or acceptance requirements.

A validation, hash, or synchronization failure leaves the previous release
current. Notification delivery failures do not roll back a valid publication;
they retry and create an operational alert.

## Customer Evidence

- Intake records the required business-use declaration separately from the
  optional marketing preference.
- Preview approval references an immutable site review revision. A later
  content, theme, form, legal-page, or domain change invalidates approval.
- Checkout freezes the commercial offer and applicable legal versions before
  starting Mollie.
- Privacy information is acknowledged through disclosure, not represented as
  consent to processing necessary for the service.
- Payment state never substitutes for terms acceptance or site approval.
- Historical acceptance and order evidence is not overwritten when a new
  release becomes current.

## Customer Requirements In The CMS

Active tenant requirements are projected through a server-only service; the
customer-facing application never receives direct access to the legal Payload
collections. Tenant users see a restrained notification in the authenticated
CMS shell. Owners can review and accept required terms in the existing
`/settings` page, while editors and viewers are told that an owner must act.

Acceptance is tenant-level even though synchronization may create one delivery
requirement per owner. One authorized owner acceptance records immutable
evidence and satisfies every matching tenant, document, and action requirement.
Checkout acceptance of the same current terms has the same convergent effect.
Historical document versions, acceptance dates, and actors remain visible as a
compact settings history.

An overdue `mandatory_reaccept` requirement blocks customer-triggered live
publication, but it does not block read access, editing, settings, or the
acceptance action itself. `reaccept_on_next_transaction` is satisfied by the
next checkout or other transaction that records the current terms. Superadmin
operational recovery remains available. Legal requirement records cannot be
mutated directly through the Payload admin; lifecycle changes go through the
legal service and retain their linked acceptance evidence.

Re-acceptance email is the primary outbound notice. A Payload scheduled task
runs every five minutes and writes a stable logical delivery to
`legal-notification-deliveries` before using the platform mail adapter. Provider
attempts remain metadata-only records in `mail-logs`; email bodies and subjects
are not persisted. Normal retries reuse the delivery key, while a lease prevents
parallel workers from sending the same logical message concurrently.

`reaccept_on_next_transaction` sends one initial notice. A
`mandatory_reaccept` release sends the initial notice, a reminder when the
enforcement date is seven days away, and a separate enforcement-day notice if
still outstanding. Acceptance or waiver removes the requirement from future
job scans. Retryable failures back off from one hour to six hours and then one
day; permanent provider failures remain visible in the requirement, outbox,
mail logs, and operational alerts for operator action.

## Tenant Website Legal Content

Platform terms and platform privacy documents are not tenant documents. During
generation, validated tenant identity, contact methods, form mode, retention,
and processor facts materialize a normal draft `pages` record using the shared
hero and rich-text block contracts. Its footer link is stored in normal chrome
data, and the customer can review and edit the page before approval. The public
renderer has no special privacy route or legal-page presentation path. SIAB
does not generate customer terms as part of the standard service.

Generated-site analytics activate only when the configured consent component is
approved and registered through the shared chrome catalog. Consent storage and
analytics gating are runtime responsibilities, but their visible controls must
come from the same approved chrome component used by CMS preview and the public
renderer. The renderer must never fall back to route-authored consent UI.

The lightweight approval registry in `@siteinabox/legal-content/consent-approval`
binds public analytics activation to the reviewed platform privacy release and
the exact approved consent version. A missing, stale, disabled, or otherwise
unapproved version must produce no public analytics configuration. The registry
also records the privacy-policy ceiling of 13 months (396 days) for identifiable
or pseudonymous analytics events. Provider-side retention remains an operational
PostHog setting and must be verified during activation and production audits;
the renderer cannot enforce deletion inside the external provider.

## Analytics Purpose Enforcement

Analytics is governed as a code contract as well as a disclosure:

- every declared CMS and public-browser event has a registered purpose, legal
  basis, consent category, retention ceiling, and direct-identifier rule;
- authenticated CMS telemetry uses explicit application events sent through an
  authenticated server endpoint; native browser autocapture is not mounted;
- the server normalizes dynamic routes, applies event-specific property
  allowlists, and drops record identifiers, contact data, and unrelated fields;
- accepted-form intelligence records only the minimized tenant-level conversion
  outcome and never uses the submission id as an analytics person id;
- an effective `renew_analytics` or `renew_all_optional` release rotates tenant
  consent versions idempotently. The serving overlay invalidates old snapshot
  consent immediately without mutating immutable snapshot evidence;
- PostHog must use IP anonymization, disabled autocapture, console capture,
  session recording, heatmaps and dead clicks, and enforced 13-month event
  retention. The sync script applies this baseline and scheduled CI detects
  production drift.

Adding or broadening analytics requires updating the purpose policy and tests,
the privacy release classification and, when consent scope changes, the
separately approved consent version. Missing or stale approval fails closed.

## Operational Ownership

- Legal/product reviewers approve text, category, effective date, audience,
  notice period, and re-acceptance policy.
- Engineering owns validation, hashes, publication mechanics, access control,
  evidence integrity, and automation.
- Support owns normal customer routing.
- Privacy owners handle rights requests and processor/controller coordination.
- Security owners handle incidents and abuse reports.
