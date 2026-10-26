import type { CollectionConfig } from "payload"
import { isSuperAdmin } from "@/access/isSuperAdmin"

export const MicrosoftMailServices: CollectionConfig = {
  slug: "microsoft-mail-services",
  admin: { useAsTitle: "domain", group: "Email" },
  access: { read: isSuperAdmin, create: () => false, update: () => false, delete: () => false },
  hooks: { beforeChange: [({ req }) => {
    if (req.context?.microsoftMailServiceMutation !== true) throw new Error("Mail services are system managed.")
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
    { name: "billingEmail", type: "email" },
    { name: "latestRun", type: "relationship", relationTo: "microsoft-mail-provisioning-runs" },
    { name: "currentPeriodEndsAt", type: "date" },
    { name: "renewalMode", type: "select", defaultValue: "manual_invoice", options: ["manual_invoice", "mollie"] },
    { name: "renewalData", type: "json", admin: { readOnly: true } },
    { name: "issueCode", type: "text" },
  ],
}
