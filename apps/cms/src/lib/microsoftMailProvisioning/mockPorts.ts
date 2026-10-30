import "server-only"
import type { MicrosoftMailProvisioningPorts } from "./workflow.ts"

/** Deterministic local E2E adapter; it never opens a provider connection. */
export function createMicrosoftMailProvisioningMockPorts(): MicrosoftMailProvisioningPorts {
  const done: MicrosoftMailProvisioningPorts["tenant_bootstrap"] = async ({ run, request }) => ({
    kind: "complete",
    data: {
      mockProviderCalls: [...(Array.isArray(run.data.mockProviderCalls) ? run.data.mockProviderCalls : []), {
        provider: "Pax8/Microsoft", operation: "tenant_bootstrap", tenantPrefix: request.tenantPrefix,
        customer: request.customer.companyName,
      }],
      customerTenantId: `mock-${request.tenantPrefix}-tenant`,
    },
  })
  const call = (provider: string, operation: string, extra: Record<string, unknown> = {}) =>
    async ({ run }: Parameters<MicrosoftMailProvisioningPorts["mca_acceptance"]>[0]) => ({
      kind: "complete" as const,
      data: { mockProviderCalls: [...(Array.isArray(run.data.mockProviderCalls) ? run.data.mockProviderCalls : []), { provider, operation, ...extra }] },
    })
  return {
    tenant_bootstrap: done,
    tenant_identity: async () => ({ kind: "complete" }),
    mca_acceptance: call("Microsoft Admin Center", "MCA acceptance recorded"),
    gdap: call("Microsoft Graph", "GDAP accepted and access assigned"),
    application_consent: call("Microsoft Entra", "partner app consent recorded"),
    subscription: async ({ run, request }) => ({
      kind: "complete",
      data: {
        pax8SubscriptionId: "mock-subscription-0001",
        mockProviderCalls: [...(Array.isArray(run.data.mockProviderCalls) ? run.data.mockProviderCalls : []), {
          provider: "Pax8", operation: "create order", product: request.product,
          commitment: request.commitment, billing: request.billing, quantity: request.quantity,
        }],
      },
    }),
    domain_verification: call("Microsoft Graph", "domain added and verified"),
    info_forward: async ({ run, request }) => ({
      kind: "complete",
      data: {
        mockProviderCalls: [...(Array.isArray(run.data.mockProviderCalls) ? run.data.mockProviderCalls : []), {
          provider: "Exchange Online PowerShell worker",
          operation: request.infoAliasTarget ? "add info@ alias to requested mailbox" : request.retainInfoForward ? "shared info mailbox and scoped forwarding policy" : "skip info@ setup",
          ...(request.infoAliasTarget ? { alias: `info@${request.domain}`, target: request.infoAliasTarget } : {}),
        }],
      },
    }),
    dkim_prepare: call("Exchange Online PowerShell worker", "create disabled DKIM config and return selector CNAME targets"),
    dns_prepare: call("Cloudflare", "publish domain verification, SPF, autodiscover, DMARC, and DKIM records; retain current MX"),
    mailbox_users: async ({ run, request }) => ({
      kind: "complete",
      data: { mockProviderCalls: [...(Array.isArray(run.data.mockProviderCalls) ? run.data.mockProviderCalls : []), ...request.mailboxUsers.map((user) => ({
        provider: "Microsoft Graph", operation: "create mailbox user and assign license", userPrincipalName: user.userPrincipalName,
      }))] },
    }),
    dns_cutover: call("Cloudflare", "switch MX to Microsoft and remove Cloudflare Email Routing MX after readiness"),
    dkim_enable: call("Exchange Online PowerShell worker", "verify published selector CNAMEs and enable DKIM signing"),
    sendSetupEmail: async ({ run, user }) => ({
      kind: "complete",
      data: { mockProviderCalls: [...(Array.isArray(run.data.mockProviderCalls) ? run.data.mockProviderCalls : []), {
        provider: "Siteinabox email", operation: "send one-time setup message", recipientStored: false,
      }] },
    }),
  }
}
