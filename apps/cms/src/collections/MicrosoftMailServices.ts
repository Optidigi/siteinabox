import type { CollectionConfig } from "payload"
import { externalMailPaymentSchema } from "@/lib/microsoftMailProvisioning/externalPayment"
import { isSuperAdmin } from "@/access/isSuperAdmin"

export const MicrosoftMailServices: CollectionConfig = {
  slug: "microsoft-mail-services",
  admin: { useAsTitle: "domain", group: "Email" },
  access: { read: isSuperAdmin, create: () => false, update: () => false, delete: () => false },
  hooks: { beforeChange: [({ req, data, originalDoc }) => {
    if (req.context?.microsoftMailServiceMutation !== true) throw new Error("Mail services are system managed.")
    if ("externalPaymentAuthorization" in data && JSON.stringify(data.externalPaymentAuthorization ?? null) !== JSON.stringify(originalDoc?.externalPaymentAuthorization ?? null)) {
      const prior = originalDoc?.externalPaymentAuthorization ? externalMailPaymentSchema.parse(originalDoc.externalPaymentAuthorization) : null
      const next = data.externalPaymentAuthorization ? externalMailPaymentSchema.parse(data.externalPaymentAuthorization) : null
      if (prior?.consumedOrderId) throw new Error("Consumed external payment authorization is immutable.")
      if (req.context?.microsoftMailExternalPaymentApproval === true && req.user?.role === "super-admin") {
        if (next?.consumedOrderId) throw new Error("New approvals cannot be pre-consumed.")
      } else if (req.context?.microsoftMailExternalPaymentConsumption === true && prior && next && next.consumedOrderId &&
        JSON.stringify({ ...next, consumedOrderId: null }) === JSON.stringify(prior)) {
        // The accepted order consumes this exact approval in its own transaction.
      } else throw new Error("External payment authorization requires its reviewed approval or consumption action.")
    }
  }] },
  fields: [
    { name: "tenant", type: "relationship", relationTo: "tenants", required: true, unique: true },
    { name: "domain", type: "text", required: true, unique: true },
    { name: "domainAuthorizedAt", type: "date", required: true },
    { name: "domainAuthorizedBy", type: "relationship", relationTo: "users", required: true },
    { name: "status", type: "select", required: true, defaultValue: "draft", options: ["draft", "provisioning", "active", "attention", "cancelled"] },
    { name: "pax8CompanyId", type: "text" },
    { name: "pax8SubscriptionId", type: "text", unique: true },
    { name: "microsoftTenantId", type: "text", unique: true },
    { name: "microsoftInitialDomain", type: "text" },
    { name: "quantity", type: "number", min: 0, defaultValue: 0 },
    { name: "mailboxes", type: "json" },
    { name: "infoAliasTarget", type: "text" },
    { name: "infoForwardTo", type: "text" },
    { name: "externalPaymentAuthorization", type: "json", admin: { readOnly: true, description: "Manager-approved funding for one initial annual mailbox order." } },
    { name: "billingEmail", type: "email" },
    { name: "latestRun", type: "relationship", relationTo: "microsoft-mail-provisioning-runs" },
    { name: "currentPeriodEndsAt", type: "date" },
    { name: "renewalMode", type: "select", defaultValue: "manual_invoice", options: ["manual_invoice", "mollie"] },
    { name: "renewalData", type: "json", admin: { readOnly: true } },
    { name: "issueCode", type: "text" },
  ],
}
