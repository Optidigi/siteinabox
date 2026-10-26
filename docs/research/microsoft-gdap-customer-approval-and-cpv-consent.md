# Microsoft GDAP approval and CSP app consent

**Reviewed:** 2026-10-26
**Scope:** Microsoft first-party documentation for an indirect CSP reseller using GDAP, automated CPV/CSP application consent, and customer-tenant Microsoft Graph operations.

## Finding

The Siteinabox customer can submit one checkbox acknowledging the service and authorizing Optidigi to act, but that checkbox does not itself activate Microsoft GDAP. Microsoft's documented GDAP workflow requires the customer Global Administrator to approve the request in Microsoft 365 admin center. The public GDAP API lets the partner create and lock a relationship request; its `approve` action is for an indirect reseller accepting a relationship created by its indirect provider, not for a customer approving the partner's request. Microsoft documents no customer-approval API.

Optidigi's authorized initial customer Global Administrator credentials can let an Optidigi operator sign into the customer tenant and perform Microsoft's documented approval in Admin Center on the customer's behalf. That keeps the customer inside Siteinabox, but it remains an Admin Center action and cannot be represented as automatic checkbox-to-GDAP approval through the documented API. The customer's authorization and the Microsoft approval are separate controls.

After GDAP is active, the supported CPV/CSP model can automate customer app consent through Microsoft's Partner Center API. This requires a multitenant application plus a partner OBO user, not app-only customer-tenant tokens. The OBO user must have the required partner roles/group membership, and the GDAP relationship must include appropriate roles (including Cloud Application Administrator or Application Administrator for the automated consent API). The OBO user's refresh token must be acquired interactively with MFA and protected/renewed; Microsoft says not to store CSP user credentials.

## Supported sequence

1. Siteinabox records the customer's MCA acknowledgement, authorized signatory data, and service/GDAP authorization. Pax8 may process its MCA attestation via the order's current Microsoft signatory fields; this is separate from GDAP.
2. Siteinabox creates the Pax8 customer/order and associates the Microsoft tenant ID, if Pax8's customer provisioning path supplies/creates it.
3. Siteinabox creates the partner-to-customer GDAP relationship with the exact approved roles and duration, then locks it for approval. The customer approves from the personalized Admin Center invitation link.
4. If Optidigi is authorized to bootstrap using the initial customer Global Administrator account, an internal Optidigi operator can complete step 3 in Admin Center. This is the documented path; it is not a customer-facing Siteinabox checkbox/API operation.
5. Once GDAP is active, Siteinabox assigns the partner security group and invokes the Partner Center CPV/CSP application-consent API, using a properly authorized partner OBO user. Then the app-plus-user/OBO model can obtain customer-scoped delegated Graph tokens for tenant/domain/user/license work.
6. Exchange-specific tasks still need an Exchange-supported auth path and the provisioned permissions; they must not silently fall back to the current unsupported app-only Graph pattern.

## Consequences for the implementation

- Do not enable live customer Graph provisioning while `createMicrosoftAppTokenProvider` uses `client_credentials` against customer tenant IDs.
- Replace/extend auth with Microsoft's secure application model: dedicated partner OBO identity; interactive MFA setup; encrypted refresh-token storage and renewal; customer-specific OBO/delegated token acquisition after active GDAP and explicit app consent.
- Keep GDAP approval as an internal operator checkpoint (or an explicit Microsoft Admin Center handoff if no authorized internal operator completes it). It can be hidden from the customer workflow, but cannot honestly be described as fully automatic through a checkbox based on Microsoft's documented APIs.
- The permission roles must be reviewed against the exact Graph operations in use. The documented consent prerequisites include Cloud Application Administrator or Application Administrator in GDAP and membership in both the assigned GDAP security group and partner AdminAgents group.
- A one-time customer-GA bootstrap can satisfy the operator authorization assumption, but Microsoft's documentation does not make the credentials a general automation credential or remove the Admin Center approval step. Never claim Microsoft publicly supports accepting a customer's GDAP request by submitting the customer's credentials to a hidden API.

## Primary sources

- [Migrate CPV/CSP applications to GDAP and the secure application model](https://learn.microsoft.com/en-us/partner-center/developer/gdap-and-secure-application-model) — supported application models, explicit app+user consent requirements, OBO setup and token handling, role prerequisites, and customer consent API payload.
- [GDAP Graph API overview](https://learn.microsoft.com/en-us/graph/api/resources/delegatedadminrelationships-api-overview?view=graph-rest-1.0) — relationship lifecycle; after partner locks the request, customer invitation link is provided for customer approval; partner then assigns access.
- [Customer approval of a partner GDAP request](https://learn.microsoft.com/en-us/partner-center/customers/gdap-customer-approval) — customer Global Administrator approves in Microsoft 365 admin center and receives confirmation.
- [Microsoft Graph delegated admin relationship request resource](https://learn.microsoft.com/en-us/graph/api/resources/delegatedadminrelationshiprequest?view=graph-rest-1.0) — `approve` is documented for an indirect reseller approving a relationship created by its indirect provider, not for customer consent.
- [Partner Center authentication](https://learn.microsoft.com/en-us/partner-center/developer/partner-center-authentication) — partner interactive MFA consent, secure refresh token use, and instruction that CSP user credentials should not be stored.
