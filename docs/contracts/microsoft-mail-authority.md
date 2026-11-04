# Microsoft mail authority and unattended bootstrap

## Product requirement and implementation status

The customer authorizes the service in Siteinabox. Their first Microsoft
interaction is mailbox sign-in, password change and security registration.
Routine customer admin approval and per-customer operator setup are not accepted
completion conditions.

The authority evaluator, provisioning gates, grant readback, private-worker
service and browser controller are implemented. The actual controller runs
against intercepted Chromium fixtures, including the complete six-step flow
and refusal/recovery cases. This is offline implementation evidence, not live
Microsoft or Pax8 qualification. The service implements the internal worker
protocol below; it is not a Microsoft/Pax8 endpoint. See the
[worker runbook](../runbooks/microsoft-mail-authority-worker.md) for commissioning,
secret/recovery lifecycle and the still-closed live gate.

Existing provider journey and operational details remain in the
[provisioning runbook](../runbooks/microsoft-mail-provisioning.md). This contract
owns the narrower customer-tenant authority requirement.

## Commercial and tenant boundaries

`provider_company` records commercial Pax8 company setup. `subscription` records
supplier commitment; `tenant_identity` records Microsoft tenant discovery and
association. None establishes customer-tenant administrator authority. Stored
legacy `tenant_bootstrap` receipts are read as `provider_company`, preserving
completed supplier actions and interrupted-action evidence without a database
rewrite. New runs and reconciliation use the accurate commercial name.

## One authority result

`mailAuthority.ts` evaluates the intersection of relationship-approved and
partner-group-assigned roles, bound to the exact customer tenant and configured
group. The effective partner user must also belong to that group and the native
partner AdminAgents group, pinned by its commissioned object ID rather than its
mutable display name. Missing identity configuration fails closed. The stored `mailAuthority` result distinguishes:

- `not_ready`: missing roles, inactive/expired delegation or invalid binding.
- `delegation_ready`: the complete delegation exists; resource access still
  needs verification.
- `ready`: delegation and versioned tenant-wide Graph/Exchange grants were
  checked, Graph organization binding matched, and the Exchange access check
  completed.

The required workload roles are User Administrator, License Administrator,
Domain Name Administrator, Exchange Administrator and Cloud Application
Administrator (Application Administrator is an accepted alternative). PRA is
bootstrap authority; it is not treated as a substitute for that workload set.
Global Reader remains useful diagnostic access, never Exchange write authority.

Evidence includes tenant, relationship, assignment, observation and expiry. It
expires after five minutes or relationship expiry, whichever comes first.
Resuming automatic work refreshes expired delegation and consent checks while
retaining all supplier/workload write receipts. Inactive or missing authority
cannot be repaired by marking a completed step or setting a boolean.

## Implemented bootstrap sequence and qualification boundary

1. Bind the provider-created tenant and default delegation to the paid order.
2. Use already approved User Administrator and PRA access to create an
   unlicensed, dedicated customer-local bootstrap administrator. Do not reset
   an existing customer administrator as routine onboarding.
3. Complete the new account's normal first-sign-in and allowed MFA enrollment
   using isolated backend browser automation.
4. As that local administrator, approve the full mail GDAP relationship and
   grant the exact delegated Graph and Exchange scopes through separate v2
   admin-consent requests. Wildcard static consent is not used.
5. Read back the matching active relationship and group assignment. Independently
   inspect tenant-wide resource grants and verify workload access.
6. Secure or retire bootstrap access under the reviewed recovery lifecycle.

Microsoft documents that GDAP PRA can promote a customer-local user to Global
Administrator or create a new Global Administrator in
[tenant-lockout scenario 2.1](https://learn.microsoft.com/en-us/partner-center/customers/gdap-preventing-tenant-lockouts).
Its [user-management instructions](https://learn.microsoft.com/en-us/partner-center/customers/manage-user-accounts)
describe the portal operations. This documents administrative capability, not a
stable API or unattended browser-automation guarantee. The browser driver has a bounded UI profile: the first Partner Center wizard
controls and Microsoft consent list/account/form were inspected directly; subsequent wizard/approval contracts have
synthetic coverage and still require live validation. Unexpected variants fail
closed. Public portal instructions are not a stable API guarantee, and private
portal API scraping is not used.

The published [Partner Center API eligibility restriction](https://learn.microsoft.com/en-us/partner-center/developer/get-started)
for indirect resellers still applies. Existing successful reads do not establish
write support. Do not silently substitute Partner Center REST create-user or
role-write calls for the browser route.

## Private worker boundary

CMS settings are `MICROSOFT_MAIL_BOOTSTRAP_WORKER_URL` (HTTPS origin),
`MICROSOFT_MAIL_BOOTSTRAP_WORKER_SECRET` (at least 32 characters) and
`MICROSOFT_MAIL_AUTHORITY_QUALIFIED=managed-admin-v1`. Leave them unset until
there is commissioned runtime configuration and reviewed live qualification evidence.
No code change in this phase sets production settings.

- Authenticated `GET /health` must return protocol
  `siab-managed-mail-authority-v1`, `unattended: true`, `qualified: true`.
- Authenticated `PUT /jobs/{id}` accepts one deterministic job. Its SHA-256 ID
  binds run/order, customer and partner tenants, initial/customer domains, app,
  security group, source/target relationships, required roles and resource scope catalogue.
- Responses echo protocol, job ID and binding, with phase `pending`, `blocked`,
  `uncertain`, or `complete`. Completion identifies the new relationship.
- Worker completion never establishes authority by itself: CMS reads Microsoft
  again. The unchanged partial relationship cannot satisfy completion.
- Requests contain no passwords, factors, customer bearer tokens or arbitrary
  approval URLs. The worker owns the encrypted bootstrap credential vault.
- The worker durably journals each privileged action before execution. It writes
  private password/factor checkpoints and verifies recovery-store readback before
  submission. Interrupted/unknown actions stop rather than replaying administrator
  creation, password change, enrollment or consent.

Unknown or malformed responses stop for reconciliation. Permanent refusals and
security challenges are exceptions, not endless propagation. Pending jobs have
an overall 30-minute bound. No approval link is returned to the customer.

New initial-order acceptance and supplier purchase require both configuration
qualification and authenticated worker readiness. A completed purchase is never
repeated to restart bootstrap. Already-purchased runs do not require worker
health merely to continue work for which sufficient authority is verified. Seat
increases on an existing tenant verify fresh authority before the supplier
quantity write, retaining those checks when mailbox work resumes.

## Resource verification and provider API ownership

| System | Operations and boundaries |
| --- | --- |
| Microsoft Graph | Partner GDAP relationship/assignment endpoints; customer `/organization`, `/servicePrincipals`, `/oauth2PermissionGrants`, domains, users and licence assignment. Customer and partner token contexts remain separate. |
| Microsoft consent | Inspect matching `AllPrincipals` grants before posting consent. Grant version v2 includes Graph `Directory.Read.All` for readback, organization/domain/user/licence scopes and Exchange `Exchange.Manage`. Existing valid local-admin consent does not require another Partner Center POST. |
| Exchange worker | Read organization configuration and check session command availability for DKIM and the requested info handling before workload writes. Command availability does not replace later live permission/parameter proof. |
| Pax8 | Commerce company/order/subscription lifecycle and exact product provisioning schema; no invented administrator-credential or richer-GDAP field. |
| Cloudflare | Exact zone and DNS/routing inspection; prepare mail records DNS-only, preserve routing until readiness, unlock managed MX with PATCH on `/zones/{zone_id}/email/routing/dns`, then guarded cutover. |

Graph readback follows bounded Microsoft-owned pagination and exact client and
resource service-principal bindings. Partial or user-specific grants are not
accepted as tenant-wide application authority. Relevant Microsoft contracts:
[delegated grant reads](https://learn.microsoft.com/en-us/graph/api/oauth2permissiongrant-list?view=graph-rest-1.0),
[service principal reads](https://learn.microsoft.com/en-us/graph/api/serviceprincipal-list?view=graph-rest-1.0),
and [the secure application model](https://learn.microsoft.com/en-us/partner-center/developer/gdap-and-secure-application-model).

Pax8 [product provisioning details](https://devx.pax8.com/reference/findprovisiondetailsbyproductid)
are dynamic per product. Cloudflare documents the
[current MX unlock operation](https://developers.cloudflare.com/api/resources/email_routing/subresources/dns/methods/edit/)
and its Zone Settings Write permission. Do not use the deprecated unlock
endpoint, disable routing as an unlock mechanism, or reorder licences as recovery.

## Verification and release boundary

Pure tests cover partial/complete/absent delegation, wrong bindings, expiry,
resource grants, permanent refusal, worker receipt binding, unknown outcomes,
qualification gates and restart without repeating writes. Commerce integration
tests use a disposable PostgreSQL database and synthetic worker/provider calls.
Existing DNS and Exchange tests remain mandatory.

No live tenant, licence, domain, administrator, consent or factor may be changed
by local tests. The live-proof marker is a release control, not a way to turn
passing mocks into production evidence. Live completion still requires separately authorized fresh-tenant qualification
and mail-flow proof. The worker's source- and policy-bound qualification file is
not created by synthetic tests.

Rollback is a compatible source rollback with provider writes kept closed.
Retain order/run and uncertain-write evidence; do not delete supplier commitments,
customer administrators, factors or grants as an automatic rollback action.
