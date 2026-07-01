import type { CollectionConfig } from "payload"
import { isSuperAdmin } from "@/access/isSuperAdmin"
import { mailIntentOptions, mailRetryStateOptions, mailStatusOptions } from "@/lib/email/sendEmail"

export const MailLogs: CollectionConfig = {
  slug: "mail-logs",
  access: {
    create: isSuperAdmin,
    read: isSuperAdmin,
    update: isSuperAdmin,
    delete: isSuperAdmin,
  },
  admin: {
    useAsTitle: "flow",
    defaultColumns: ["flow", "status", "retryState", "provider", "sender", "recipient", "tenant", "createdAt"],
    description: "Metadata-only outbound mail delivery log. Rendered subjects, bodies, and secrets are not stored.",
    listSearchableFields: ["sender", "recipient", "provider"],
  },
  fields: [
    { name: "flow", type: "select", required: true, options: mailIntentOptions, index: true },
    {
      name: "tenant",
      type: "relationship",
      relationTo: "tenants",
      index: true,
      admin: { description: "Tenant context when the mail belongs to a generated site or tenant operation." },
    },
    { name: "sender", type: "text", required: true, index: true },
    { name: "replyTo", type: "text" },
    { name: "recipient", type: "text", required: true, index: true },
    { name: "status", type: "select", required: true, options: mailStatusOptions, index: true },
    { name: "provider", type: "text", required: true, defaultValue: "cloudflare-smtp", index: true },
    { name: "providerMessageId", type: "text" },
    { name: "providerErrorCode", type: "text" },
    { name: "providerErrorMessage", type: "textarea" },
    { name: "retryState", type: "select", required: true, defaultValue: "none", options: mailRetryStateOptions, index: true },
    { name: "sentAt", type: "date" },
    { name: "failedAt", type: "date" },
  ],
}
