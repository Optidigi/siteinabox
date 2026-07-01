import type { CollectionConfig } from "payload"
import { isSuperAdmin } from "@/access/isSuperAdmin"

export const operationalAlertSeverities = ["info", "warning", "error", "critical"] as const
export const operationalAlertStatuses = ["open", "acknowledged", "resolved"] as const
export const operationalAlertSources = ["mail", "forms", "domains", "payments", "intake", "system"] as const

export const OperationalAlerts: CollectionConfig = {
  slug: "operational-alerts",
  access: {
    create: isSuperAdmin,
    read: isSuperAdmin,
    update: isSuperAdmin,
    delete: isSuperAdmin,
  },
  admin: {
    useAsTitle: "message",
    defaultColumns: ["severity", "status", "source", "message", "tenant", "occurrenceCount", "lastSeenAt"],
    listSearchableFields: ["message", "dedupeKey"],
    description: "Admin-visible operational alerts. Metadata only; secrets and rendered mail bodies are not stored.",
  },
  fields: [
    {
      name: "severity",
      type: "select",
      required: true,
      defaultValue: "warning",
      index: true,
      options: operationalAlertSeverities.map((value) => ({ label: value, value })),
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "open",
      index: true,
      options: operationalAlertStatuses.map((value) => ({ label: value, value })),
    },
    {
      name: "source",
      type: "select",
      required: true,
      index: true,
      options: operationalAlertSources.map((value) => ({ label: value, value })),
    },
    { name: "dedupeKey", type: "text", required: true, unique: true, index: true },
    { name: "message", type: "text", required: true },
    {
      name: "tenant",
      type: "relationship",
      relationTo: "tenants",
      index: true,
      admin: { description: "Tenant context when the alert belongs to a generated site or tenant operation." },
    },
    { name: "metadata", type: "json", admin: { description: "Non-secret operational metadata only." } },
    { name: "occurrenceCount", type: "number", required: true, defaultValue: 1, min: 1 },
    { name: "firstSeenAt", type: "date", required: true, index: true },
    { name: "lastSeenAt", type: "date", required: true, index: true },
    { name: "acknowledgedAt", type: "date" },
    { name: "acknowledgedBy", type: "relationship", relationTo: "users" },
    { name: "resolvedAt", type: "date" },
    { name: "resolvedBy", type: "relationship", relationTo: "users" },
  ],
}
