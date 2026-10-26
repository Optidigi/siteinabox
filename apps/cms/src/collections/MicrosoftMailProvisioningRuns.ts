import type { CollectionConfig } from "payload"
import { isSuperAdmin } from "@/access/isSuperAdmin"

const lifecycleWriteAllowed = (context: unknown) =>
  Boolean(context && typeof context === "object" && "microsoftMailProvisioningLifecycle" in context &&
    (context as { microsoftMailProvisioningLifecycle?: unknown }).microsoftMailProvisioningLifecycle === true)

export const MicrosoftMailProvisioningRuns: CollectionConfig = {
  slug: "microsoft-mail-provisioning-runs",
  admin: { useAsTitle: "domain", hidden: true },
  access: {
    create: ({ req }) => req.user?.role === "super-admin" && lifecycleWriteAllowed(req.context),
    read: isSuperAdmin,
    update: ({ req }) => req.user?.role === "super-admin" && lifecycleWriteAllowed(req.context),
    delete: () => false,
  },
  hooks: {
    beforeChange: [({ req }) => {
      if (!lifecycleWriteAllowed(req.context)) {
        throw new Error("Provisioning runs can only be changed by the reviewed lifecycle service.")
      }
    }],
  },
  fields: [
    { name: "idempotencyKey", type: "text", required: true, unique: true, index: true },
    { name: "mode", type: "select", required: true, options: ["mock", "live"] },
    { name: "tenantId", type: "number", required: true, index: true },
    { name: "commerceOrder", type: "relationship", relationTo: "orders", unique: true },
    { name: "mailService", type: "relationship", relationTo: "microsoft-mail-services" },
    { name: "domain", type: "text", required: true, index: true },
    { name: "tenantPrefix", type: "text", required: true },
    { name: "request", type: "json", required: true },
    { name: "state", type: "select", required: true, index: true, options: [
      "prepared", "tenant_pending", "consent_pending", "subscription_pending", "domain_pending", "dns_pending",
      "mailboxes_pending", "exchange_pending", "setup_mail_pending", "ready", "manual_review", "failed", "cancelled",
    ] },
    { name: "currentStep", type: "text" },
    { name: "completedSteps", type: "json", required: true },
    { name: "data", type: "json", required: true },
    { name: "actionUrl", type: "text" },
    { name: "issueCode", type: "text" },
    { name: "actionLeaseToken", type: "text", access: { read: () => false }, admin: { hidden: true } },
    { name: "actionLeaseUntil", type: "date", access: { read: () => false }, admin: { hidden: true, readOnly: true } },
  ],
  timestamps: true,
}
