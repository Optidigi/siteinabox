# Pax8 MCA and GDAP: customer interaction and API research

**Reviewed:** 2026-10-26
**Question:** Can Siteinabox capture customer authorization and have Microsoft Customer Agreement (MCA) acceptance and Granular Delegated Admin Privileges (GDAP) happen without the customer visiting Microsoft Admin Center?

## Conclusion

**Verdict: the customer-facing target is achievable, but the current code is not
ready to run it.** A single clear Siteinabox consent action can plausibly cover
MCA acknowledgement and authorization for Optidigi to bootstrap/administer the
tenant, if Siteinabox shows the actual current MCA, records the authorized
signatory and acceptance evidence, and submits the current Pax8 signatory
fields. Optidigi would still need an internal bootstrap action to accept the
GDAP requests using the authorized initial customer Global Admin account; no
supported customer-GDAP approval API was found.

- **MCA:** Pax8's current partner updates say customers must accept the current
  MCA through either the Pax8 Marketplace/partner attestation API or direct
  acceptance. The live EEA offer exposes customer-authorized signatory fields
  in Pax8's dynamic order schema, and mock order validation accepts them.
  Pax8's guidance says the partner represents that the customer received and
  acknowledged the MCA and that the partner has authority to submit the
  customer's signatory details. This supports implementing the acceptance in
  Siteinabox, provided the exact agreement is presented and the authorized
  signatory's action is recorded. A bare generic order-confirmation checkbox
  is insufficient evidence.
- **GDAP:** The partner can create a relationship request and poll its state.
  Microsoft's documented customer approval is still performed by a customer
  Global Administrator in Microsoft 365 Admin Center. The documented Graph
  `approve` action for an indirect reseller approves a relationship created by
  its indirect provider; it does not approve the customer's GDAP request. Pax8
  documents its own GDAP tooling and says separate Pax8-to-customer and
  MSP-to-customer relationships exist, but its public material does not show
  an API that silently records the customer's approval.
- **Customer experience:** customer sees Siteinabox, acknowledges the MCA, and
  authorizes the subscription, tenant bootstrap, and requested partner access.
  Optidigi performs the Microsoft admin-center GDAP steps internally using the
  already-authorized initial tenant administrator. This meets the goal that
  the customer never sees Microsoft Admin Center, but the GDAP approval itself
  is not a backend API call.
- **Additional implementation blocker:** the current CMS Microsoft client
  uses application-only Graph tokens and an Entra `adminconsent` URL. Microsoft
  documents multitenant application-only consent as unsupported for third
  party CSP/CPV apps under GDAP. The documented GDAP pattern is multitenant
  application plus OBO user, with delegated partner consent through Partner
  Center after GDAP is active. The Microsoft client/consent architecture must
  be redesigned before E2E mailbox operations are considered ready.
- **Current implementation:** the UI remains operator-oriented, exposes a
  customer-facing Microsoft GDAP link, asks an operator to attest MCA
  completion, renders Pax8's GDAP HTML link template as a raw dynamic field,
  and uses the unsupported app-only GDAP consent pattern. No real order or
  tenant approval was made.

## MCA evidence and implications

### Microsoft rules for an indirect reseller

Microsoft states that only an indirect provider or direct-bill CSP partner can
use the Partner Center agreement-attestation API. An indirect reseller cannot
attest on its own and must work through its indirect provider. The current
attestation flow uses a Microsoft-provided embeddable component to present the
MCA and capture acceptance, then the provider creates the agreement through
the API. Microsoft says the customer primary contact receives an automated
email after partner attestation; that notification is not sent when the
customer directly accepts in Microsoft 365 Admin Center.

Sources:

- [Microsoft: MCA agreement and notification rules](https://learn.microsoft.com/en-us/partner-center/customers/confirm-customer-agreement)
- [Microsoft: enhanced MCA attestation API and embeddable component](https://learn.microsoft.com/en-us/partner-center/customers/integrate-sandbox-confirm-customer-accept)

### What Pax8 publicly confirms

Pax8's November 2025 APAC update says that, effective January 5, 2026, new
customers must accept the MCA through the Pax8 Marketplace by providing the
customer's signatory-authority first name, last name, and email address. It
explicitly says partners cannot enter their own contact details and accept on
the customer's behalf. Pax8's January and February 2026 updates confirm the
two supported routes are partner attestation API or direct acceptance. Pax8's
2025 EMEA/US monthly partner newsletter states that when the partner submits
the signatory details, it represents that the customer received and
acknowledged the agreement and that the partner has authority to submit those
details. It tells partners to provide the MCA to the customer and ensure they
agree and acknowledge it. This is the strongest support for capturing
acceptance in Siteinabox without Microsoft Admin Center.

This is consistent with the rep's statement that Pax8 can handle MCA. A live,
read-only API probe of Optidigi's exact Microsoft 365 Business Basic EEA (no
Teams) offer found these current dynamic provisioning fields:

- `mca2020FirstName` — First Name (Customer Signatory Authority)
- `mca2020LastName` — Last Name (Customer Signatory Authority)
- `mca2020Email` — Email Address (Customer Signatory Authority)
- `microsoftGDAPDirect` — Pax8 GDAP relationship detail containing a link to
  Pax8's GDAP tool, with instructions to enter the customer's tenant ID first
- `msTenantId`, `msCustExists`, `msDomain`, `msMPNidval`, Microsoft contact
  fields, and company registration number

The live API therefore exposes signatory fields in the same order payload used
by Siteinabox and a Pax8-specific GDAP handoff. Combined with Pax8's
representation language, this supports the intended pattern: Siteinabox
displays the current MCA, the authorized customer signatory accepts it in
Siteinabox, and the order includes that signatory's details. The mock result
does not verify Pax8's live downstream attestation, read-back status, or email
behavior. The `mca2020` field names also warrant confirmation that they remain
the supported fields for the current agreement.

It also does not tell us whether:

1. A Pax8 partner can initiate this through an API rather than the Marketplace.
2. Pax8 can host/proxy an embeddable acceptance inside Siteinabox.
3. A Siteinabox flow that displays the current MCA and captures an authenticated
   signatory's acceptance plus the partner representation is sufficient, or if
   Pax8 requires a separate MCA component/page.
4. Pax8 exposes an acceptance ID/status/webhook to Siteinabox.
5. The exact Pax8 and Microsoft email recipients and notification settings.

Sources:

- [Pax8: November 2025 Microsoft update, MCA signatory details](https://www.pax8.com/blog/microsoft-update-apac-november-2025/)
- [Pax8 monthly partner newsletter: customer acknowledgement and partner-authority representation](https://www.pax8nebula.com/m/2627ab4d9fc284d2/original/Microsoft-CSP-Monthly-Product-and-Pricing-Updates-USD.pdf)
- [Pax8: January 2026 Microsoft update](https://www.pax8.com/blog/microsoft-update-january-2026/)
- [Pax8: February 2026 Microsoft update](https://www.pax8.com/blog/microsoft-update-february-2026/)

### Public Pax8 Developer API and live API review

The current published [Pax8 Partner API OpenAPI specification](https://devx.pax8.com/openapi/partner-endpoints.json)
lists Companies, Products, Orders, Subscriptions, and Contacts. The `POST
/v1/orders` flow can carry product provisioning details and the product's
provisioning fields are dynamic. The published specification contains an older
Microsoft Office 365 E3 example with `mca2020FirstName`, `mca2020LastName`,
`mca2020Email`, and `mca2020EffectiveDate`, plus `msTenantId`. These fields
show that Microsoft-specific provisioning data has existed in order payloads;
they do **not** establish that the fields implement the current enhanced MCA
attestation or that they are valid for today's Business Basic EEA offer.

The published v1 paths and schemas contain no separate MCA-attestation,
customer-agreement, GDAP-relationship, or customer-approval API operation. The
spec does contain an older E3 example with `mca2020*` fields, and the live
Business Basic EEA provisioning-details endpoint returned the signatory and
`microsoftGDAPDirect` fields listed above. The GDAP field's `possibleValues`
contains an HTML link template to `https://tools.pax8.com/gdap?${substitutionKey}`
and says the customer tenant ID must be entered first. This is evidence of a
Pax8 GDAP tool/handoff, not evidence of a backend API that approves customer
GDAP without an administrator action. The public API does not explain how the
substitution key is generated for a Siteinabox order.

#### Live API verification performed

Using Optidigi's stored Pax8 API credentials, I:

1. Authenticated successfully (`POST /v1/token`, HTTP 200).
2. Queried the catalog and confirmed the exact product is
   `Microsoft 365 Business Basic EEA (no Teams) [New Commerce Experience]`.
3. Fetched current provision details, dependencies, and pricing. The one-year
   commitment option is present, with `billingTerm: Annual` available.
4. Submitted a **two-seat annual 1-year-commitment mock order** with mock
   signatory values to the existing internal smoke-test company using
   `POST /v1/orders?isMock=true`. Pax8 returned HTTP 200 and one validated line
   item. The response had no order ID. Follow-up reads found zero orders and
   zero subscriptions for that smoke-test company.

Pax8 documents `isMock=true` as validation only, skipping database
interactions. This verifies that the Pax8 API accepts the order shape and
signatory fields for the selected product; it does **not** verify that a real
order triggers an MCA attestation, that Pax8 creates or approves either GDAP
relationship, what messages are sent, or that a customer sees no Microsoft or
Pax8 page. No real order, tenant operation, GDAP approval, MCA attestation, or
email was performed.

Relevant Pax8 references:

- [Pax8 OpenAPI directory](https://devx.pax8.com/openapi/)
- [Pax8 order guide](https://devx.pax8.com/docs/ordering-details)
- [Create order API](https://devx.pax8.com/reference/createorder)
- [Dynamic product provisioning details API](https://devx.pax8.com/reference/findprovisiondetailsbyproductid)
- [Create company API](https://devx.pax8.com/reference/createcompany)

Pax8's order guide documents company activation, product/pricing/dependency
lookups, dynamic provisioning details, and mock order validation. `isMock=true`
validates without creating production data. It does not make an order or
agreement acceptance. Pax8 API credentials are broad internal partner
credentials; its docs say third-party applications must use its delegated
OAuth process. The public Pax8 MCP server exposes categories such as companies,
orders, products, and subscriptions, but the public description does not list
MCA or GDAP actions. MCP is an operator/AI integration, not a Siteinabox
customer-consent substitute.

The CMS's focused mail-provisioning mock suite was run: **35/35 tests passed**.
It covers the Pax8 adapter's OAuth/query handling, catalog and provisioning
field reads, annual mock-order validation, idempotent workflows, and handling
uncertain writes. This verifies our adapter with mocked HTTP boundaries; the
live `isMock=true` request above verifies Pax8's own validation path.

Additional references:

- [Pax8 authentication and credential guidance](https://devx.pax8.com/docs/authentication)
- [Pax8 delegated OAuth for third-party apps](https://devx.pax8.com/docs/developingdelegationapplications)
- [Pax8 MCP Server overview](https://devx.pax8.com/docs/mcp-server)

## GDAP evidence and implications

Microsoft's GDAP Graph API can create a relationship, lock it for customer
approval, provide an invitation URL, read request/relationship state, and
create role access assignments. Microsoft says the customer explicitly grants
GDAP and that the relationship becomes active after the customer approves the
invitation. Its customer guidance says the customer Global Admin opens the
link and chooses **Approve all** in Microsoft 365 Admin Center.

The `approve` member on `delegatedAdminRelationshipRequest` has a narrower
meaning: it is used by an **indirect reseller** to approve a relationship
created for that reseller by an **indirect provider**. It is not the customer
approval step.

Pax8 says it needs a separate GDAP relationship with each end customer for
Pax8 provisioning/support, and the MSP separately needs a relationship for
its own tenant access. Its published guidance describes using Pax8's GDAP
tool to generate customer approval links. This supports a Pax8-assisted
workflow, not checkbox-only backend customer approval.

### Microsoft app consent constraint (implementation blocker)

Microsoft's CSP/CPV GDAP application model explicitly says multitenant
application-only consent is **not supported** for third-party applications
using GDAP. It documents an application-plus-user/OBO model instead. Partner
Center can automate that app-plus-user consent for each customer after the
partner's GDAP relationship is active; the GDAP relationship needs an
Application Administrator or Cloud Application Administrator role and the
calling partner user must be in the assigned GDAP security group and
`AdminAgents` group. Microsoft says an OBO partner account uses MFA and its
refresh token must be renewed at least every 90 days.

The current Siteinabox implementation uses app-only Graph tokens for customer
tenant actions and sends customers to Entra's `/adminconsent` endpoint. That
design conflicts with Microsoft's documented GDAP model. It needs an
application-plus-user/OBO redesign (or an alternate Microsoft-approved
architecture) before the Graph user/license/domain automation is a viable E2E
path. Exchange PowerShell auth must be reviewed separately against the same
delegated model.

Source:

- [Microsoft: GDAP + secure application model migration](https://learn.microsoft.com/en-us/partner-center/developer/gdap-and-secure-application-model)

Sources:

- [Microsoft Graph GDAP workflow](https://learn.microsoft.com/en-us/graph/api/resources/delegatedadminrelationships-api-overview?view=graph-rest-1.0)
- [Microsoft customer GDAP approval steps](https://learn.microsoft.com/en-us/partner-center/customers/gdap-customer-approval)
- [Microsoft meaning of the GDAP `approve` action](https://learn.microsoft.com/en-us/graph/api/resources/delegatedadminrelationshiprequest?view=graph-rest-1.0)
- [Pax8 GDAP for MSPs and Pax8](https://www.pax8.com/blog/microsoft-gdap-for-msps/)

### Community signal (anecdotal, not policy)

A 2023 small-MSP discussion describes a reseller generating the relationship
link and approving it in a private browser while signed in as the customer's
admin, with that delegated bootstrap stated in the customer contract. Another
commenter notes the Pax8 and MSP relationships are separate. This matches the
customer-invisible **operator** flow we can use with the customer's explicit
authorization; it does not establish a supported API or remove Microsoft's
Global Admin approval requirement. Treat it as an operational precedent, not
current vendor documentation.

- [Reddit: indirect provider customers and GDAP](https://www.reddit.com/r/SmallMSP/comments/14b7mp2/do_your_clients_show_up_in_customers_indirect/)

## Current UI gaps found in review

- The main workflow is an Optidigi operations page, not a customer dashboard
  action. It can support the internal provisioning queue, but it is not yet a
  cohesive client consent/order flow.
- `Pax8PreflightPanel` displays all dynamic Pax8 provisioning fields as generic
  text/select controls. The live `microsoftGDAPDirect` field is an HTML link
  template; showing that as a giant select option doesn't invoke the Pax8
  handoff and could submit the wrong value. It needs a typed adapter that
  recognizes the link/instruction field and surfaces it as an internal task.
- The current MCA step asks an operator to confirm acceptance in Microsoft
  Admin Center. It does not render the MCA, collect customer signatory
  acceptance, or store agreement evidence.
- The current Microsoft client obtains application-only Graph tokens and the
  consent callback handles `/adminconsent`; this conflicts with Microsoft's
  CSP/CPV GDAP app model above.
- The customer-facing and operator-facing approvals need separate views: one
  Siteinabox authorization/acceptance action for the customer, then a clear
  internal checklist for tenant bootstrap, Pax8 GDAP, Optidigi GDAP, and OBO
  app consent. Do not show backend credentials or Pax8's internal substitution
  token/link as customer actions.

## Recommended Siteinabox flow

### Customer-facing interaction

1. Authenticated customer selects the domain, mailbox users, forwarding, and
   plan.
2. Siteinabox displays the applicable current MCA. The authorized signatory
   checks **I have reviewed and accept this Microsoft Customer Agreement for
   this organization**. Record agreement version/language, customer and actor
   IDs, signatory name/email, timestamp, and the authority declaration. Submit
   the current Pax8 signatory fields and partner representation with the
   order. This is the likely one-click MCA path supported by Pax8's
   representation language, but Pax8 must confirm the live order creates and
   exposes the corresponding agreement status.
3. A separate authorization panel summarizes the SKU, seat count, annual
   billing, one-year term, renewal/cancellation constraints, tenant bootstrap,
   requested GDAP roles, domain/DNS writes, and mailbox forwarding. If the
   authenticated user is also the signatory, prefill their name/email. Keep
   clear that this action authorizes Optidigi; it is not Microsoft's GDAP
   approval.
4. Optidigi's internal queue handles tenant bootstrap and both GDAP paths.
   Where Microsoft requires Admin Center approval, the authorized Optidigi
   operator signs into the customer tenant as the initial Global Admin and
   approves the generated requests. The customer stays in Siteinabox.
5. After GDAP is active, use the Microsoft-supported app-plus-user/OBO consent
   flow. The customer does not need a separate app-only consent screen.
6. Siteinabox shows progress and sends its mailbox-ready messages. MCA
   attestation may generate a Microsoft email to the signatory contact, and
   GDAP approval may generate a separate confirmation. Pax8-generated mail
   behavior remains unverified.

### Internal provisioning

1. Pax8 product/order APIs place the licensed order and expose current product
   provisioning details. Do not treat order acceptance as MCA acceptance.
2. Tenant/bootstrap information is obtained through the confirmed Pax8 flow.
   Do not infer that `msTenantId` or the older `mca2020*` example fields
   establish a new-tenant or current-MCA flow.
3. Create the Pax8-to-customer and Optidigi-to-customer GDAP relationships as
   required. Keep each relationship's roles, duration, and customer identity
   visible in the internal run record.
4. Optidigi operator uses the initial customer Global Admin account, under
   the Siteinabox authorization, to approve the customer-side requests. Keep
   this a controlled operator step; don't store/replay raw customer GA
   credentials in an unattended job.
5. After GDAP is active, use Microsoft Partner Center's application-plus-user/
   OBO consent path and delegated Graph tokens. Replace the current app-only
   client before treating the order as E2E-ready.
6. Continue with domain/DNS, Exchange configuration, mailbox setup, and
   Siteinabox notification.

## Pax8 confirmation needed before enabling a checkbox-only flow

Ask the Pax8 Channel Account Manager or Microsoft provisioning team to answer
these in writing, and provide the applicable API reference or partner-only
documentation:

1. What is the exact API/feature name that accepts MCA through Pax8's partner
   attestation API? Is it available to Optidigi as an indirect reseller,
   including for Microsoft 365 Business Basic EEA without Teams?
2. Can Siteinabox start the customer acceptance without sending the customer
   to Pax8 Marketplace or Microsoft 365 Admin Center? Is there a Microsoft MCA
   embeddable component, Pax8-hosted component, tokenized URL, or callback?
3. Which customer signatory details, agreement version, acceptance timestamp,
   evidence, and company authority declaration must Siteinabox submit?
4. Does acceptance permit order submission through Pax8's public API, or must
   a marketplace/order operation be completed separately?
5. What API status, agreement ID, event/webhook, retry, revocation, or audit
   endpoint confirms acceptance? Does the `mca2020*` provisioning data remain
   valid or is it legacy-only?
6. For GDAP, can Pax8's current platform/API create the Pax8-to-customer and
   Optidigi-to-customer relationships without the customer opening a Microsoft
   Admin Center link? What exactly does `microsoftGDAPDirect` do, when is its
   `substitutionKey` generated, and which relationship does it create? If
   Optidigi performs approval as customer Global Admin, what is the supported
   Pax8 audit trail and resulting customer notification?
7. Pax8's current provisioning field text says it no longer creates users or
   assigns licenses through its API because of GDAP/Graph limitations. Does
   this restriction apply only to Pax8's own workflow, or also to a partner
   application using Microsoft's GDAP app-plus-user/OBO model and delegated
   Graph permissions?
8. Confirm every Pax8/Microsoft email emitted on new-tenant creation, MCA
   attestation, reseller relationship, GDAP, order, and subscription events,
   including recipient selection and suppression controls.

## Current implementation status

The tenant-owner `/email` page now collects mailbox details, MCA acknowledgement,
and service/GDAP authorization inside Siteinabox. It creates a tenant-scoped
`prepared` run record and displays a customer-safe status page. The operational
run remains super-admin-only and can open the customer request prefilled for
Pax8 preflight. The customer page does not show Microsoft approval URLs or
Pax8's internal GDAP link template.

**No provider action runs on customer submission.** The request is saved with
its consent evidence; the Pax8 order is not placed, no tenant is changed, and
no message is sent. Live Pax8 orders are explicitly disabled because the CMS
still uses app-only customer Graph consent, which is incompatible with the
documented GDAP CSP/CPV application model. The internal Pax8 dynamic-field
renderer now treats `microsoftGDAPDirect` as an internal handoff instead of a
selectable order value. The remaining work for automatic provisioning is the
supported OBO/Partner Center consent implementation, the Pax8 MCA attestation
read-back, and the internal GDAP approval operating process.
