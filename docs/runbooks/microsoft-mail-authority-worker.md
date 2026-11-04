# Private Microsoft mail authority worker

## Scope

The worker implements the backend browser bootstrap required by the
[authority contract](../contracts/microsoft-mail-authority.md). It does not buy
subscriptions, register domains, change DNS or send customer setup mail. Those
remain owned by CMS/Pax8/Graph/Exchange/Cloudflare adapters. No per-customer
operator setup is part of its supported flow. Unexpected security requirements
and unknown writes are exceptions held for reconciliation.

The service and controller are implemented and exercised offline with real
Chromium and synthetic provider screens. This is not fresh-tenant live proof.
The observed Partner Center first-page controls and Microsoft consent scope
buttons/account/form contract are dated 2026-11-04. The own-partner consent
prompt was inspected and cancelled without granting permissions. Later wizard,
registration and approval variants remain unqualified until live verification.
The inspected partner session showed authorization errors and disabled creation
fields on the non-Tap2case tenant. No account was created or changed by inspection.

## Runtime and platform commissioning

Use the exact root `.nvmrc` LTS and frozen pnpm workspace install, including the
package-owned Chromium, installed at the read-only
`PLAYWRIGHT_BROWSERS_PATH` declared by the service template. Runtime code lives in `packages/mail-authority-worker`.
The service checks the Node pin at startup. Live mode also launches a blank
sandboxed Chromium before opening its listener; unavailable sandbox/runtime
support fails startup rather than disabling isolation.

Use a dedicated Linux identity, not the CMS or Exchange worker identity. Run
commissioning, status and rehearsal CLIs as that same Unix identity; file
ownership is enforced even for local administrative calls. The
[service template](../../ops/mail-authority-worker/mail-authority.service) runs
read-only source and configuration, permits writes only to private state and
recovery storage, and disables core dumps. Adapt reviewed installation paths;
do not expose port 8082. The listener is restricted to loopback. Put an
approved host-side TLS proxy in front of it for the CMS HTTPS client. All
requests, including health, require the dedicated bearer secret.

1. Install reviewed source/dependencies and the exact Node/Chromium runtime.
   Do not run dependency approval or package/browser upgrades as a side effect.
2. Prepare two private recovery-capable roots, mode 0700, owned by the worker.
   `backupRoot` must be a separate off-host recovery mount, outside `stateRoot`.
   A different local directory is sufficient for synthetic tests, not live
   host-loss protection. Atomic rename and fsync must work on both stores. `backupMount` pins the
   approved remote mountpoint, filesystem type and source. Live startup, health
   and each checkpoint validate `/proc/self/mountinfo`; an absent mount cannot
   silently fall back to the local directory underneath it.
3. Generate independent 32-byte password and factor keys in the approved secret
   store. Make their mounted files readable only by the worker (0600 or 0400).
   Keep independently protected recoverable key versions outside the state roots.
   The service bearer secret must be at least 32 characters. Retain keys while
   any associated administrator or unknown action may still need recovery.
4. Start from the [configuration example](../../ops/mail-authority-worker/config.example.json).
   It is deliberately invalid until actual IDs, partner account, redirect URI
   and reviewed consent labels are supplied. Keep `liveEnabled: false`.
5. Verify the registered multitenant app and partner integration identity have
   their reviewed delegated permissions. Customer consent uses the exact shared
   Graph/Exchange scope catalogue, not wildcard `/.default` consent. Configure
   separate `consentPermissionLabels.graph` and `.exchange` lists from the real
   English Microsoft prompts; no extra permission is accepted implicitly.
   Pin the verified native partner AdminAgents object ID in CMS
   `MICROSOFT_PARTNER_ADMIN_AGENTS_GROUP_ID`; confirm its native Partner Center
   identity during platform commissioning, not just its mutable display name.
   Runtime checks compare IDs and fail closed when the setting is absent.
   Commission a dedicated partner identity with the approved GDAP group access.
   Supply its actual account/password/software-OATH seed through private stdin
   to `node packages/mail-authority-worker/src/commission.mjs CONFIG_PATH`.
   Use secure secret intake; never put values in arguments, shell history,
   chat, source or screenshots. Commissioning encrypts the partner record,
   encrypts the factor under its separate key, and proves recovery-store readback.
   It refuses to overwrite an existing credential version. Real commissioning
   always verifies the remote mount, even while live mode is off. Remove the private intake file
   according to the secret-store lifecycle after verified recovery.
6. Install the service under the reviewed host configuration, still closed to
   work. CMS settings remain blank until qualification: bootstrap HTTPS origin,
   dedicated service secret and the existing authority qualification marker.

This is one-time platform commissioning, not customer onboarding. Password and
factor keys are separate at rest, but the trusted worker can use both at runtime;
this is not hardware-independent or phishing-resistant MFA. Partner and local
admin credentials never pass through CMS runs or customer setup-link endpoints.
The partner browser credentials support the chosen browser route, not a claimed
Microsoft SAM password-based API flow. Routine workloads use the existing SAM
token provider after bootstrap. CMS verifies that effective partner principal
membership includes the configured workload group and AdminAgents before order
acceptance and resource readiness; assigned roles alone are insufficient. The
Exchange worker must advertise protocol version 2, which includes capability
checks. An older worker is rejected before accepting a new order. Review that credential custody against platform
security policy before live release.

## Platform credential rotation

Close qualification and stop the worker before maintenance. Increment the
commissioned `credentialVersion`, supply the replacement account/password/factor
through the same private intake, and restart under the new configuration.
Existing credential versions are not overwritten. The version changes the policy
digest, so prior qualification cannot silently authorize the replacement. Verify
normal partner authentication and recovery before reopening the gate. This is
platform maintenance, not a customer approval step. Encryption-key rotation
requires a separately reviewed rewrap/recovery procedure; never discard keys for
outstanding or uncertain jobs.

## Execution and interruptions

CMS creates and locks the exact full-role GDAP request through Microsoft's
public Graph API before submitting a deterministic worker job. The worker:

1. Creates a dedicated unlicensed customer-local administrator using the normal
   partner user wizard, rejecting existing matching users and selected licences.
2. Promotes that exact local account with partner PRA authority.
3. Accepts the provider temporary-password format (minimum eight characters),
   then replaces it with a generated strong managed password. Completes permitted software-OATH setup.
   A fresh isolated sign-in must actually pass an OTP challenge and show the
   registered authenticator before security setup is considered complete.
4. Approves the exact full-role GDAP request as the customer-local admin.
5. Approves the pinned application through two narrow v2 admin-consent requests,
   one for Graph and one for Exchange. Each entire consent list must match its
   commissioned allowlist. Each Microsoft redirect must contain the expected
   tenant, state, successful admin-consent result and exact granted scope set;
   per-resource receipts are durably checkpointed. No OAuth code is exported.
6. Clears retained browser session snapshots and returns the target relationship.
   CMS independently verifies Microsoft relationships, assignments and grants.

Each privileged step is journaled before execution. Password replacements and
factor data are durably encrypted and recovered from the backup store before
submission. There is one attempt per password-change/OTP action in a login flow.
Rejected or unchanged forms stop; codes are not swept or repeatedly submitted.
Browser navigation, account editors and password-form destinations are bound to
Microsoft and the expected tenant/account. CAPTCHA, push-only, passkey-only,
compliant-device demands and unfamiliar screens stop without policy changes.

A killed process leaves a lock/started marker. The service never reaps the lock
or retries that action automatically. Use
`node packages/mail-authority-worker/src/status.mjs CONFIG_PATH JOB_ID` for
sanitized phase/step/issue evidence. Reconcile provider state and the private
recovery record before any repair. There is no public force-resume, password
reveal, OTP-by-account or generic browser-command endpoint.

No browser trace, screenshot, raw provider exception, password or factor is
logged. Bootstrap administrators remain encrypted recovery identities; they are
not silently deleted, demoted or reset as generic rollback. Privileged-account
retirement requires verified workload access and a reviewed recovery policy.

## Qualification and verification

Run `pnpm --dir packages/mail-authority-worker test` or the `mail-authority`
verification profile. Browser tests intercept all provider traffic and block DNS
escape. They exercise the actual driver, encrypted journal, authenticated HTTP
boundary, restart markers, credential/factor recovery and refusal paths. CI
executes the package in the pinned browser lane. Run CMS focused/integration
checks, shared contract types and source/dependency controls for changes crossing
that boundary.

For the first controlled live proof, keep `liveEnabled: false` and stop the
ordinary service. A privileged local operator may run
`node packages/mail-authority-worker/src/rehearse.mjs CONFIG_PATH JOB_PATH APPROVAL_PATH`.
The private job must be the exact shared protocol object exported for the
explicitly authorized test tenant. The owner-only approval file must contain
`kind: managed-mail-authority-rehearsal`, the exact `jobId` and `tenantId`,
`customerAuthorizationRecorded: true`, `approvedAt` and `expiresAt` (maximum one
hour). Rehearsal unconditionally checks the real recovery mount and sandbox,
uses the same journal/controller, and cannot buy licences or change DNS. It
returns nonsecret result/revision/policy evidence with `qualified: false`;
it never creates a general qualification file or exposes an HTTP bypass.
A missing/invalid approval, open live service, wrong identity, missing recovery
mount or uncertain action stops the rehearsal. No rehearsal ran in this phase.

The later full-pipeline test needs a new disposable Pax8 company/customer tenant,
a new controlled domain and the smallest paid mailbox licence order supported by
the selected offer. Obtain a fresh quote and explicit order/domain-spend approval
first; no trial or purchase is implicit in this implementation. An unlicensed
bootstrap account is separate from the paid mailbox. Never reuse Tap2case,
production customer accounts, existing customer GA credentials or historical
consent/session state. Use synthetic customer contact data where the supplier
permits it, isolate notifications, verify delivery to/from a controlled mailbox,
and review subscription term/cancellation and domain cleanup before spending.

Before live release, independently verify the exact UI profile and full pipeline
on a separately authorized disposable tenant. Record actual permissions,
credential custody, off-host/key recovery, interruption handling, mailbox delivery
and supplier notices. The qualification file must match protocol, UI profile,
current source revision, policy digest, app and partner IDs, reviewed observation
and expiry times, `qualified: true` and `offHostRecoveryVerified: true`. Startup
logs the nonsecret revision/policy digest; the latter binds runtime/browser,
redirect, account/credential version, consent labels and storage/mount policy. No qualification file is
created by passing synthetic tests. Changes invalidate mismatched evidence.

Rollback closes worker qualification/CMS writes and stops the service. Preserve
encrypted state, backup/key versions, locks and supplier/run evidence. Do not
replay purchases or erase uncertain security transactions.

Microsoft documents [narrow dynamic admin-consent scopes](https://learn.microsoft.com/en-us/entra/identity-platform/v2-admin-consent).
The resource catalogue is shared between worker requests and CMS grant readback.
It prevents partner-only configured permissions from being silently included in
customer consent through wildcard static consent.

Effective partner membership uses Microsoft's
[transitive group-membership API](https://learn.microsoft.com/en-us/graph/api/user-list-transitivememberof?view=graph-rest-1.0),
including the required eventual-consistency header and count for the group cast.
Commercial renewal acceptance does not depend on bootstrap or Exchange sessions;
mailbox-changing operations retain their live authority prerequisites. CMS and
Exchange protocol-2 changes require coordinated release; the old protocol is not
silently treated as capability verification.
