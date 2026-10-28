# Microsoft mail provisioning

## Scope and current state

`/email` is the tenant owner's payment-gated email flow. `/accounts` lets a
super-admin create an email-only workspace, authorize its email domain, manage
its team, choose online or external billing, and record a platform-fee
exemption. A website and a site-generation run are not required. Existing
website customers keep website access through the additive migration.

Implemented provider adapters cover Pax8, Microsoft Graph/Partner Center,
Cloudflare DNS and the private Exchange PowerShell worker. Customer screens
show mailbox details, price, agreement authorization, payment and progress;
Microsoft/Pax8 administration remains internal. **The customer's checkbox
records authorization; it does not impersonate Microsoft's GDAP approval.**
The initial tenant bootstrap, verified tenant mapping, agreement completion
reference and authorized Global Admin approval are operator checkpoints.
Neither a public Pax8 credential-retrieval API nor a silent GDAP customer-
approval API is assumed. Pax8 may require its own GDAP handoff as well.

Local verification uses synthetic HTTP responses and an explicitly owned
PostgreSQL test resource. It does not prove live supplier permissions, tenant
bootstrap/notice behavior, or external mailbox delivery. No real customer,
subscription, DNS change or supplier order is created by the tests. Production
configuration, worker-image qualification and the first live order are a
separate deployment phase. Feature flags default to disabled.

## Account and billing policy

1. Open **Customer accounts** (`/accounts`), create/select a workspace and
   enable Email. Authorize its domain. Add an owner through **Manage team**;
   the existing invitation/login system serves email-only workspaces too.
2. For a managed customer, select **Exempt from Siteinabox platform fees**,
   enter the reason and optional expiry, and save. The audited history records
   actor, time, services, payment route and policy. No customer-name checks or
   hardcoded exceptions exist. Amicare and Tap2case can use this control later;
   this implementation does not create or modify those accounts.
3. The exemption waives Siteinabox's own fee, including any configured mail
   platform fee. Microsoft retail license charges, provider cost floors, VAT
   and domain charges remain payable. Already accepted quotes are immutable.
4. A policy change flags existing platform billing agreements for review.
   Automatic platform charging remains blocked while the stored policy is
   exempt, including after its expiry, until the policy and agreements are
   deliberately reviewed. Expiry never silently restarts collection. Existing
   paid/exempt website access and email account access are separate controls.
5. Select **Invoice email outside Siteinabox** when payment happens separately.
   The owner still accepts the exact order. A super-admin then records its exact
   amount, currency, reference and received date on the internal order. This
   creates an immutable manual payment attempt and invoice evidence. A general
   tenant-level “paid” flag cannot provision licenses. Online billing uses the
   existing Mollie ledger/webhook flow with a one-off annual payment.

The initial supported commercial scope is Dutch businesses, EUR, 21% VAT,
Microsoft 365 Business Basic EEA **without Teams**, annual commitment and annual
payment. Set an explicit net retail seat price; Pax8 buy rates are not customer
prices. Current supplier costs are checked again before committing a purchase.
A Mollie test payment cannot unlock live provisioning.

## Customer and provider sequence

1. The owner enters the authorized domain, organization/signatory and mailbox
   list. Addresses are derived from the domain. Setup delivery addresses are
   required for this flow only; they are not Microsoft recovery addresses.
   An optional **+ Alias toevoegen** adds `info@` to one requested mailbox.
2. Read-only catalog and DNS/routing calls prepare a 15-minute quote. The owner
   reviews the total and accepts the current Siteinabox legal documents and
   annual commitment. Acceptance freezes the mailbox intent, price and routing
   snapshot in an Order. Only one accepted/pending order per mail service is
   permitted, so renewal and seat changes cannot race each other.
3. Mollie checkout or an exact super-admin external receipt moves the order to
   paid/fulfillment pending. The existing job queue resumes it. No provider
   purchase occurs before matching settled payment authority is checked.
4. Siteinabox creates/links one Pax8 company and places one annual subscription
   order with quantity equal to the number of users. The current dynamic Pax8
   provisioning fields include the signatory details; unsupported required
   fields stop for review. An existing unbound provider company is never
   silently adopted by website match. Mock validation precedes the real order.
5. Internally verify the Microsoft tenant GUID and initial `.onmicrosoft.com`
   domain, record agreement completion evidence and approve the requested GDAP
   relationship with the authorized initial customer Global Admin account.
   Credentials are not collected in the customer form or persisted in run JSON.
   The app verifies the active relationship's tenant, roles and assigned group.
6. Partner Center submits the customer application grants; Graph organization
   identity and a read-only Exchange organization call verify access. Incomplete
   grants have a bounded propagation wait and internal repair control, rather
   than an endless retry. The consent version is recorded for later seat runs.
7. Graph verifies the domain and creates/licenses users. Cloudflare prepares
   verification, SPF, autodiscover, DMARC and DKIM records. Exchange mailbox
   readiness and the alias/forward are verified before MX moves to Microsoft.
   A final routing hash check stops if legacy routes changed since acceptance.
   For Cloudflare-managed locked MX records, the adapter then unlocks DNS with
   `PATCH /zones/{zone_id}/email/routing/dns` and verifies the mail DNS snapshot
   is unchanged before applying cutover. It preserves Email Routing rules and
   forwarding; it never disables the routing service to unlock records. Denied,
   uncertain, still-locked or changed-snapshot results stop before MX edits.
8. Exchange verifies DKIM CNAME resolution before enabling signing. Siteinabox
   sends one branded setup message per distinct setup recipient in the batch;
   each mailbox has a 48-hour, one-use credential link. Temporary passwords
   stay encrypted at rest and are never in email. Delivered setup addresses
   and run credential bundles are cleared; the existing mail-log retention
   policy still applies to delivery metadata.

If an existing Cloudflare `info@` forward exists and no replacement alias is
selected, the quote preserves its destination. Exchange creates a shared
`info@` mailbox and an external-forwarding rule/policy scoped to that mailbox.
An existing licensed/conflicting recipient stops for review; the worker does
not convert it or enable tenant-wide forwarding. Other unsupported routes or
active catch-all routing block cutover for review. Existing historical mail is
not migrated by this provisioning flow.

Additional mailboxes reuse the same Microsoft tenant, domain and Pax8
subscription. A seat order charges the extra users for the verified remainder
of the annual term and increases subscription quantity once. Its frozen
provider commitment dates must still match before that update. Old fulfilled
order replays cannot rewind quantity or coverage. Removing seats, mailbox data
migration and customer self-service cancellation are outside this first flow.

## Renewal and nonpayment

The hourly job reads actual subscription commitment dates. At 45 days before
term end it prepares a renewal draft and sends a branded Siteinabox renewal
notice. The owner accepts/pays that order, or a super-admin records external
payment. Paid coverage is verified against quantity, period and the settled
payment attempt. At the new term, provider readback must match the purchased
period and product before coverage advances.

If the next period is unpaid at the 14-day cutoff, the job schedules cancellation
at the explicit verified term end through Pax8's documented `cancelDate` query
parameter. It never issues an immediate/default-date cancellation or assumes an
undocumented writable auto-renew flag. An uncertain cancellation is held for
internal reconciliation; it is not resubmitted blindly. Refunds/chargebacks create an internal payment-adjustment alert; supplier commitments require review rather than inferred cancellation. Missing term dates,
provider failures and ambiguous payment synchronization create internal commerce
alerts. Operators must monitor them. Late payment after cancellation is scheduled
requires supported provider recovery before checkout/provisioning resumes.
Disabling live writes also stops this maintenance; monitor the exposure before
leaving the global stop in place near a renewal cutoff.

## Configuration for the deployment phase

Use the runtime secrets store; do not commit credentials. Browser/MCP sessions
are not deployable backend credentials. A readiness badge checks configuration
presence; acceptance also checks partner refresh and private-worker health.

| Settings | Purpose |
| --- | --- |
| `PAX8_CLIENT_ID`, `PAX8_CLIENT_SECRET` | Internal Pax8 API OAuth credentials. |
| `PAX8_MPN_ID`, `PAX8_ORDER_EMAIL` | Reseller identity and an already reachable internal operations contact. `orderedByUserEmail` is not assumed to control all supplier mail routing. |
| `MICROSOFT_PARTNER_TENANT_ID`, `MICROSOFT_PARTNER_APP_CLIENT_ID`, `MICROSOFT_PARTNER_APP_CLIENT_SECRET` | Multitenant partner app, separate from ordinary customer Microsoft sign-in. |
| `MICROSOFT_PARTNER_APP_REDIRECT_URI` | Registered HTTPS CMS callback: `/operations/microsoft-mail/consent/callback`. |
| `MICROSOFT_PARTNER_TOKEN_ENCRYPTION_KEY` | Dedicated random 32-byte base64 or 64-hex key for the stored partner refresh token and OAuth handshake. Retain securely through restarts. |
| `MICROSOFT_GDAP_ROLE_DEFINITION_IDS`, `MICROSOFT_PARTNER_SECURITY_GROUP_ID` | Reviewed GDAP roles and partner security group containing the integration user. |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Zone lookup/DNS read-write and **Email Routing Rules Read** for authorized domains. **Zone Settings Write** is also required to unlock legacy Email Routing MX records at cutover. |
| `EXCHANGE_WORKER_URL`, `EXCHANGE_WORKER_SHARED_SECRET` | Private worker endpoint and random secret of at least 32 characters. Remote endpoints require HTTPS; the exact unexposed Compose service address is also supported. |
| `SIAB_EXCHANGE_WORKER_IMAGE_DIGEST` | Qualified immutable worker image for the Compose overlay. |
| `MICROSOFT_MAIL_SETUP_ENCRYPTION_KEY` | Separate random 32-byte base64 or 64-hex key for temporary credentials/setup tokens. Retain for outstanding links. |
| `MICROSOFT_MAIL_CURRENCY`, `MICROSOFT_MAIL_ANNUAL_SEAT_NET_MINOR`, `MICROSOFT_MAIL_PLATFORM_FEE_NET_MINOR` | EUR and reviewed retail net euro-cent prices; platform fee defaults to zero. Confirm supplier account currency independently. |
| `SITE_URL` | Public HTTPS CMS origin for payment callbacks and setup links. |
| Existing Cloudflare Email API or SMTP settings, `EMAIL_FROM` | Siteinabox operational/setup messages via the existing mail pipeline. |
| Existing Mollie live configuration | Required for online payment. The normal staged commerce gate and its production prerequisites still apply to payment creation. External receipts do not need a Mollie payment. |
| `MICROSOFT_MAIL_CHECKOUT_ENABLED`, `MICROSOFT_MAIL_LIVE_PROVISIONING_ENABLED` | Both remain `false` until configured and intentionally enabled. |
| Existing `COMMERCE_RELEASE_STAGE`, `COMMERCE_PROVIDER_WRITES_ACKNOWLEDGED`, `COMMERCE_RELEASE_EVIDENCE_VERSION`, `COMMERCE_ORIGIN_ISOLATION_VERIFIED` | Mail live writes require production stage, matching evidence, acknowledgement and origin isolation. Disabled/shadow also stop mail. Never bypass existing release controls. |

Configure/admin-consent the partner app's delegated Graph permissions for GDAP
relationship/assignment management, organization read, domains, users and license
assignment, the Partner Center `user_impersonation` permission, and delegated
Exchange `Exchange.Manage`. The code uses application-plus-user refresh grants
for each resource/target tenant, never customer client-credentials tokens.
The integration user must belong to the configured assigned group and the partner
`AdminAgents` group; GDAP needs Application Administrator or Cloud Application
Administrator for application consent plus the customer operations roles.
Verify the precise least-privilege set in the live rehearsal before opening
checkout. App permission presence alone does not grant customer GDAP authority.

A super-admin connects the dedicated partner integration user under
`/operations/microsoft-mail/connect`. The OAuth callback checks actor/state,
PKCE, nonce, signed Microsoft identity and Partner Center MFA compliance before
persisting the encrypted refresh token. Rotation is serialized and persisted.
Conditional Access/token revocation can require internal reconnection; the
customer is not asked to sign into an admin page.

Openprovider is not called to register or transfer an already managed email
domain. DNS must already be delegated to the authorized active Cloudflare zone.
The existing general online-commerce production gate may still require its
normal domain-commerce configuration; do not weaken it for this feature.

## Deployment, recovery and rollback

Follow the existing protected delivery/image process for CMS. The Exchange worker
is a separate artifact; see [its build and smoke procedure](../../ops/exchange-worker/README.md).
The shared publisher supports CMS, renderer, site, PostgreSQL, Exchange worker and cloudflared.
Approve the worker's verified immutable artifact through that publisher before
setting the overlay digest. Keep both flags off while migrations and config are applied.
The overlay joins CMS and worker on an unexposed outbound-capable bridge and
publishes no worker port. Keep background Payload jobs enabled in production.

Use the committed Payload migration sequence; never synthesize production SQL
or migration state. Fresh-schema and existing-website upgrades are rehearsed on
owned disposable PostgreSQL. Rollback is disabling checkout/live flags and
reverting application code while retaining additive tables/columns and audit
records. Destructive down-migration is not the rollback procedure for orders
that may already have supplier commitments.

Every external write has an explicit durable checkpoint. An unknown provider
response stops for reconciliation instead of repeating a billable purchase,
quantity update or mail delivery. Internal run pages show exact paid-order,
bootstrap and provider reconciliation controls. Verify provider IDs/quantity
against the order before resuming. Known incomplete app grants can be explicitly
replaced by the internal repair action; an unknown repair outcome is held.
Reconnecting the partner resumes waiting work without purchasing again.

Supplier-generated messages cannot be suppressed by the Siteinabox UI. During
the first authorized live order, record the actual Pax8/Microsoft invitations,
confirmations, recipients and Exchange inbound/outbound delivery, including
`info@`. Do not promise “exactly one email from all parties.” Siteinabox groups
its own setup notice; normal payment, login, legal and renewal messages remain
in the existing communication policy. Resolve the supplier-mail behavior before
broad customer rollout.
