# Microsoft mail provisioning contract

**Status reviewed:** 2026-11-04

**Authority:** This document is the concise product/behavior contract. The
[provisioning runbook](../runbooks/microsoft-mail-provisioning.md) is the
operator procedure and configuration reference; executable behavior and tests
remain authoritative when implementation changes.

## Product boundary

Siteinabox sells and coordinates a Microsoft 365 mailbox service. It owns the
customer order, payment evidence, provisioning checkpoints, DNS coordination,
setup-link delivery and customer-facing progress. The providers remain separate:

| System | Responsibility |
| --- | --- |
| Pax8 | Reseller company, subscription order/quantity and supplier lifecycle |
| Microsoft Graph / Partner Center | Tenant identity, GDAP/application-consent workflow, domains, users and licences |
| Exchange Online worker | Exchange mailbox readiness, mailbox permissions, routing and DKIM operations |
| Cloudflare | DNS and supported Email Routing inspection/cutover |
| Siteinabox | Quote/order/payment ledger, unattended authority bootstrap, branded notices and recovery |

Openprovider is not used to register or transfer a domain in this flow. The
domain must already be delegated to the authorized Cloudflare zone.

## Customer journey and email promise

1. A customer owner chooses the email service, domain, mailbox names, reachable
   setup recipients, and reviews price, annual term and legal authorization in
   Siteinabox. Every inbox is a paid, licensed account. `info@` and `admin@` are
   offered only as name suggestions; any name may be typed. New orders offer no
   shared inboxes and no aliases: customers manage those in Outlook themselves.
   Stored historic requests with a shared `info@` inbox or alias keep working.
2. Siteinabox freezes the accepted intent. Provisioning cannot purchase or
   change supplier state until the matching payment (online or reviewed manual
   receipt/sponsorship evidence) is settled and the live-release gates permit it.
3. Backend workers verify the tenant and complete Microsoft administration
   under the [mail authority contract](microsoft-mail-authority.md). A Siteinabox
   checkbox records service authorization; the backend separately establishes
   actual Microsoft GDAP and application consent. No ordinary customer admin
   handoff or per-customer operator setup is part of the supported target.
4. Siteinabox provisions provider subscription, Microsoft users/licences,
   Exchange and DNS in resumable checkpoints, then sends a branded setup email
   to each distinct setup recipient in the batch. The message contains a
   one-use setup link (48-hour expiry), not a temporary password.
5. The customer opens that link once to retrieve the sign-in details and signs
   in with just the email address and password: no forced password change and,
   by default, no Microsoft Authenticator registration (see
   [Password-only sign-in](#password-only-sign-in)). Progress is shown in
   Siteinabox. Normal payment, login, legal, renewal and other configured
   communications remain governed by their existing flows.

**Email guarantee:** Siteinabox groups its own mailbox setup notice by distinct
recipient. It does not promise one email in total across Pax8, Microsoft,
payment, login, legal and Siteinabox. Supplier notices cannot be suppressed by
the Siteinabox UI, and actual supplier recipients/notice behavior are not yet
proven by a live authorized order. Never describe the journey as “exactly one
email from everyone.” The first authorized live order must record actual sender,
recipient and message counts before that claim is reconsidered.

## Password-only sign-in

Product decision (2026-11-13): mailbox users sign in with only their address and
password. Two Microsoft defaults are changed for that:

- Users are created with `forceChangePasswordNextSignIn: false`. The delivered
  password is long (four groups of five unambiguous characters, about 116 bits)
  and is the customer's password.
- The `sign_in_policy` provisioning step switches the customer tenant's
  **security defaults** off before any mailbox user exists. Security defaults
  otherwise force every user to register Microsoft Authenticator at first sign-in
  and offer no skip.

Customers can turn **two-step sign-in** on (and off again) in the email workspace.
It is tenant-wide: it switches security defaults back on for every account of
that customer. Siteinabox changes the setting only on the first observation or on
an explicit customer/operator request made after the last observation; a change
made outside Siteinabox is reported (`SIGN_IN_POLICY_CHANGED_OUTSIDE_SITEINABOX`)
and never reverted automatically.

This weakens account security for customers who keep the default: accounts are
protected by a password only. Microsoft's mandatory MFA for admin portals is not
affected, and does not apply to Outlook users. Microsoft does not document
re-enabling security defaults after an administrator disabled them, nor rule it
out, so the setting is monitored. Not yet proven by a live sign-in: that no other
registration prompt (for example Microsoft's password-reset registration campaign
announced for October 2026) interrupts a Business Basic user.

## Consent and authority

- The order records the customer's accepted service intent and authorized
  signatory evidence. The current supported commercial scope is Dutch business,
  EUR, Microsoft 365 Business Basic EEA without Teams, annual commitment and
  annual payment; the price shown to the customer is an explicit retail price,
  not Pax8 buy-rate.
- Microsoft GDAP approval is performed by a dedicated managed customer-local
  administrator through the private backend worker. Effective role assignments,
  group membership, resource grants and workload capabilities are independently
  verified before continuing. The worker route remains closed until qualified;
  see the [authority contract](microsoft-mail-authority.md).
- Customer Microsoft credentials are not collected in the customer form or
  persisted in provisioning run JSON. The partner integration uses the
  application-plus-user refresh-token flow; it is not customer-tenant
  app-only client credentials.
- Pax8/Microsoft API behavior, supplier agreement acceptance readback and
  vendor email routing must not be inferred from a mock response or local test.

Primary references: [Microsoft GDAP approval](https://learn.microsoft.com/en-us/partner-center/customers/gdap-customer-approval),
[Microsoft GDAP API overview](https://learn.microsoft.com/en-us/graph/api/resources/delegatedadminrelationships-api-overview?view=graph-rest-1.0),
[Microsoft CSP secure application model](https://learn.microsoft.com/en-us/partner-center/developer/gdap-and-secure-application-model),
[Microsoft MCA confirmation](https://learn.microsoft.com/en-us/partner-center/customers/confirm-customer-agreement),
and the [Pax8/MCA/GDAP research record](../research/pax8-mca-gdap-customer-flow.md).

## Durable lifecycle and failure behavior

The provisioning-run state is persisted independently from the commerce Order
and Microsoft mail service. The implementation-defined states in
`apps/cms/src/lib/microsoftMailProvisioning/state.ts` are:

`prepared` → `tenant_pending` / `consent_pending` /
`subscription_pending` / `domain_pending` / `dns_pending` /
`mailboxes_pending` / `exchange_pending` / `setup_mail_pending` → `ready`.

`manual_review`, `failed` and `cancelled` are explicit outcomes; `manual_review`
may resume only through an allowed operator-controlled transition. The exact
per-state transition table in `state.ts` is the executable authority.

The key safety rules are:

- An unknown external-write result is held for reconciliation, never blindly
  retried. This applies especially to Pax8 purchases/quantity changes and
  setup-email delivery.
- A retry or restart resumes from durable evidence; it must not repeat a
  completed supplier write or rewind a fulfilled order.
- A service is not exposed as ready until provider readback and the requested
  mailbox/DNS/Exchange checks have passed.
- Feature flags and production commerce release gates default closed. Mock and
  synthetic tests are not live supplier, permission, DNS-write or inbox-delivery
  evidence.

## Verified implementation shape (repository review)

The repository contains a customer `/email` order flow, email-only workspace
support, a super-admin customer-flow entry point, operator pages and OAuth
callback under `/operations/microsoft-mail`, durable order/payment/run/setup
token records, provider adapters, and private Exchange and authority workers. Relevant
implementation roots are `apps/cms/src/lib/microsoftMailProvisioning/`,
`apps/cms/src/app/(frontend)/(admin)/email/`,
`apps/cms/src/app/(frontend)/(admin)/operations/microsoft-mail/`, and
`ops/exchange-worker/` and `packages/mail-authority-worker/`.

The parser derives Microsoft mailbox UPNs from the selected domain and keeps
the reachable setup email separate from Microsoft user data
(`model.ts`). The workflow exposes explicit wait/manual-review outcomes
(`workflow.ts`, `livePorts.ts`); the job runner and durable store are in
`fulfillment.ts`, `payloadStore.ts` and the provisioning-run collections.
Outbound mail behavior is governed separately by
[`email.md`](email.md).

This repository review confirms the source/contracts and test-backed behavior,
not production readiness. Local tests use synthetic provider responses. The
implemented controller has real Chromium fixture coverage, but later Microsoft
setup-screen variants and the complete new-tenant/mail-delivery route still need
fresh live qualification. No real Pax8 order is authorized by this document.

## Canonical operational detail

Use the [Microsoft mail provisioning runbook](../runbooks/microsoft-mail-provisioning.md)
for exact checkout sequence, flags, environment settings, operator actions,
recovery, scoped rollout and deployment controls. Update this contract whenever
customer-visible behavior, provider ownership, email guarantees, authority
requirements or lifecycle safety rules change. Do not maintain a competing
summary in the historical research note; that note records its own dated
research and source trail.
