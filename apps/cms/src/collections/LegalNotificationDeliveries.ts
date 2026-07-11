import type { CollectionConfig } from "payload"
import { adminEnumOption, adminText } from "@/lib/payloadAdminI18n"
import { isSuperAdmin } from "@/access/isSuperAdmin"

const options = (values: readonly string[]) => values.map(adminEnumOption)

export const legalNotificationKinds = ["initial", "reminder", "enforcement"] as const
export const legalNotificationStatuses = ["queued", "processing", "sent", "failed", "cancelled"] as const

export const LegalNotificationDeliveries: CollectionConfig = {
  slug: "legal-notification-deliveries",
  labels: { singular: { en: "Legal notification", nl: "Juridische kennisgeving" }, plural: { en: "Legal notifications", nl: "Juridische kennisgevingen" } },
  access: {
    create: () => false,
    read: isSuperAdmin,
    update: () => false,
    delete: () => false,
  },
  admin: {
    useAsTitle: "notificationKey",
    defaultColumns: ["notificationKey", "tenant", "recipient", "kind", "status", "nextAttemptAt", "sentAt"],
    description: adminText("System-managed outbox for idempotent legal requirement email delivery.", "Door het systeem beheerd postvak voor idempotente bezorging van e-mails over juridische vereisten."),
  },
  fields: [
    { name: "notificationKey", type: "text", required: true, unique: true, index: true },
    { name: "requirement", type: "relationship", relationTo: "legal-requirements", required: true, index: true },
    { name: "tenant", type: "relationship", relationTo: "tenants", required: true, index: true },
    { name: "recipient", type: "email", required: true, index: true },
    { name: "kind", type: "select", required: true, options: options(legalNotificationKinds), index: true },
    { name: "templateVersion", type: "text", required: true },
    { name: "status", type: "select", required: true, defaultValue: "queued", options: options(legalNotificationStatuses), index: true },
    { name: "attemptCount", type: "number", required: true, defaultValue: 0, min: 0 },
    { name: "nextAttemptAt", type: "date", required: true, index: true },
    { name: "leaseUntil", type: "date", index: true },
    { name: "lastAttemptAt", type: "date" },
    { name: "sentAt", type: "date", index: true },
    { name: "provider", type: "text" },
    { name: "providerMessageId", type: "text" },
    { name: "retryState", type: "select", options: options(["none", "retryable", "permanent"]) },
    { name: "lastError", type: "textarea" },
  ],
}
