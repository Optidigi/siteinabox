import type { CollectionConfig, JSONFieldValidation } from "payload"
import { canRead, canWrite } from "@/access/roleHelpers"
import { hasUnvalidatedAuthSignal } from "@/access/authSignals"
import { validateTenantExists } from "@/hooks/validateTenantExists"
import { sendEmail, type MailLogPayload } from "@/lib/email/sendEmail"
import { relationshipId } from "@/lib/relationshipId"
import { resolveVerifiedTenantSender } from "@/lib/tenants/emailSending"
import { adminText, adminValidationText } from "@/lib/payloadAdminI18n"

// Audit-p1 #5 sub-fix 2 (T4) — payload-size DoS cap on the public-create
// surface. The audit's suggested cap is ~32 KB, sized for typical contact-
// form payloads (name + email + message + a few hidden fields) with
// comfortable headroom. Enforced as a field-level `validate` on `data` so
// the rejection happens before any DB write and surfaces a 400 with a
// readable error rather than a Postgres column-size or oom error later.
//
// Boundary is INCLUSIVE — exactly 32_768 bytes is permitted; over is
// rejected. Documented in the test (Case 11) and the batch report.
//
// `value == null` is normalised to `{}` before measurement so partial
// updates that don't touch `data` (e.g. an admin marking a submission as
// "read") don't trip the cap.
const MAX_FORM_DATA_BYTES = 32_768

const validateFormData: JSONFieldValidation = (value, { req } = {} as any) => {
  const serialised = JSON.stringify(value ?? {})
  if (serialised.length > MAX_FORM_DATA_BYTES) {
    return adminValidationText(req?.i18n?.language, `Data exceeds the ${MAX_FORM_DATA_BYTES}-byte limit (${serialised.length} bytes received)`, `Gegevens overschrijden de limiet van ${MAX_FORM_DATA_BYTES} bytes (${serialised.length} bytes ontvangen)`)
  }
  return true
}

const cleanText = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const safeEmail = (value: unknown): string | null => {
  const email = cleanText(value)?.toLowerCase()
  if (!email || email.includes("\n") || email.includes("\r")) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const nl2br = (value: string) => escapeHtml(value).replace(/\n/g, "<br />")

const firstStringFromRecord = (value: unknown, keys: string[]) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  for (const key of keys) {
    const text = cleanText(record[key])
    if (text) return text
  }
  return null
}

type FormNotificationPayload = {
  find(args: {
    collection: "site-settings" | "tenant-notification-subscriptions"
    where: Record<string, unknown>
    limit: number
    depth: number
    overrideAccess: true
  }): Promise<{ docs: unknown[] }>
  findByID(args: {
    collection: "tenants"
    id: string | number
    depth: 0
    overrideAccess: true
  }): Promise<unknown>
  logger?: {
    warn?: (message: string | Record<string, unknown>, meta?: Record<string, unknown>) => void
  }
  create?: MailLogPayload["create"]
}

type FormNotificationDoc = {
  id?: string | number
  tenant?: unknown
  formName?: unknown
  pageUrl?: unknown
  data?: unknown
  email?: unknown
  name?: unknown
  message?: unknown
}

export async function notifyTenantOfFormSubmission({
  doc,
  payload,
}: {
  doc: FormNotificationDoc
  payload: FormNotificationPayload
}) {
  const tenantId = relationshipId(doc.tenant as Parameters<typeof relationshipId>[0])
  if (tenantId == null) {
    payload.logger?.warn?.("[forms] tenant notification skipped", {
      reason: "missing_tenant",
      formId: doc.id,
    })
    return
  }

  try {
    const [subscriptionResult, tenant] = await Promise.all([
      payload.find({
        collection: "tenant-notification-subscriptions",
        where: { and: [{ tenant: { equals: tenantId } }, { formSubmissions: { equals: true } }] },
        limit: 100,
        depth: 1,
        overrideAccess: true,
      }),
      payload.findByID({
        collection: "tenants",
        id: tenantId,
        depth: 0,
        overrideAccess: true,
      }),
    ])
    const recipients = Array.from(new Set(subscriptionResult.docs
      .map((subscription) => {
        const record = subscription as { email?: unknown; user?: unknown }
        const member = record.user && typeof record.user === "object" ? record.user as { email?: unknown; tenants?: Array<{ tenant?: unknown }> } : null
        const memberTenant = relationshipId(member?.tenants?.[0]?.tenant as Parameters<typeof relationshipId>[0])
        const currentEmail = safeEmail(member?.email)
        const routedEmail = safeEmail(record.email)
        return memberTenant === String(tenantId) && currentEmail === routedEmail ? currentEmail : null
      })
      .filter((email): email is string => Boolean(email))))
    if (recipients.length === 0) {
      payload.logger?.warn?.("[forms] tenant notification skipped", {
        reason: "missing_subscription",
        tenantId,
        formId: doc.id,
      })
      return
    }

    const sender = resolveVerifiedTenantSender(tenant as Parameters<typeof resolveVerifiedTenantSender>[0])
    if (!sender) {
      payload.logger?.warn?.("[forms] tenant notification skipped", {
        reason: "tenant_sender_unverified",
        tenantId,
        formId: doc.id,
      })
      return
    }

    const message = tenantFormNotificationTemplate(doc)
    const deliveries = await Promise.allSettled(recipients.map((recipient) => sendEmail({
        to: recipient,
        from: sender.senderEmail,
        replyTo: safeEmail(doc.email ?? firstStringFromRecord(doc.data, ["email", "contactEmail"])) ?? undefined,
        subject: message.subject,
        html: message.html,
        text: message.text,
        intent: "forms.tenant_notification",
        category: "tenant_operational",
        tenantSubscriptionCategory: "formSubmissions",
        preferenceSubject: recipient,
        tenant: tenantId,
        payload: payload as unknown as Parameters<typeof sendEmail>[0]["payload"],
      })))
    const failures = deliveries.filter((delivery) => delivery.status === "rejected")
    if (failures.length > 0) {
      payload.logger?.warn?.("[forms] tenant notification delivery partially failed", {
        tenantId,
        formId: doc.id,
        failed: failures.length,
        attempted: deliveries.length,
      })
    }
  } catch (error) {
    payload.logger?.warn?.("[forms] tenant notification failed", {
      tenantId,
      formId: doc.id,
      error: error instanceof Error ? error.message : "Unknown form notification error",
    })
  }
}

export function tenantFormNotificationTemplate(doc: FormNotificationDoc) {
  const formName = cleanText(doc.formName) ?? "Website form"
  const submitterName = cleanText(doc.name ?? firstStringFromRecord(doc.data, ["name", "naam"])) ?? "Unknown"
  const submitterEmail = safeEmail(doc.email ?? firstStringFromRecord(doc.data, ["email", "contactEmail"]))
  const pageUrl = cleanText(doc.pageUrl)
  const message = cleanText(doc.message ?? firstStringFromRecord(doc.data, ["message", "bericht", "notes"]))

  const rows = [
    ["Form", formName],
    ["Name", submitterName],
    ["Email", submitterEmail ?? "-"],
    ...(pageUrl ? [["Page", pageUrl] as const] : []),
  ]
  const htmlRows = rows
    .map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`)
    .join("")
  const htmlMessage = message
    ? `<h2>Message</h2><p>${nl2br(message)}</p>`
    : ""
  const text = [
    `New form submission: ${formName}`,
    `Name: ${submitterName}`,
    `Email: ${submitterEmail ?? "-"}`,
    ...(pageUrl ? [`Page: ${pageUrl}`] : []),
    ...(message ? ["", "Message:", message] : []),
  ].join("\n")

  return {
    subject: `New form submission: ${formName}`,
    html: `<p>A new generated-site form submission was stored in the CMS.</p>${htmlRows}${htmlMessage}`,
    text,
  }
}

export const Forms: CollectionConfig = {
  slug: "forms",
  labels: { singular: { en: "Form submission", nl: "Formulierinzending" }, plural: { en: "Form submissions", nl: "Formulierinzendingen" } },
  access: {
    read: canRead,
    // Public form posts: any unauthenticated visitor can submit. Three layers
    // compose to close the audit-p1 #5 (T4) anonymous-abuse vector:
    //   (a) Middleware rate-limit (src/proxy.ts) — 10 POSTs / 60s / IP
    //       on requests with NO auth signals. Real API-key clients must not
    //       be limited by the anonymous public-form bucket.
    //   (b) THIS gate — reject when `req.user` is null AND the request
    //       presented an Authorization header or payload-token cookie.
    //       That combination means the caller TRIED to authenticate but
    //       Payload's strategies couldn't validate the credential — i.e.
    //       a bypass attempt against the middleware's presence-only check.
    //       Bogus-auth attackers get 403 here; the flood vector closes.
    //   (c) Per-record `data` 32 KB cap on the json field (sub-fix 2 below).
    create: ({ req }) => {
      if (req.user) return true
      if (hasUnvalidatedAuthSignal(req)) return false
      return true
    },
    update: canWrite,
    delete: ({ req }) => req.user?.role === "super-admin" || req.user?.role === "owner"
  },
  admin: {
    useAsTitle: "email",
    defaultColumns: ["email", "name", "formName", "status", "createdAt"],
    description: adminText("Submissions inbox. Created by public form posts; managed by tenant editors.", "Postvak voor inzendingen. Aangemaakt via openbare formulieren en beheerd door klantredacteuren.")
  },
  fields: [
    { name: "formName", type: "text", required: true },
    { name: "pageUrl", type: "text" },
    { name: "data", type: "json", required: true, validate: validateFormData,
      admin: { description: { en: "Full submitted payload (maximum 32 KB).", nl: "Volledige ingediende gegevens (maximaal 32 KB)." } } },
    { name: "email", type: "text" },
    { name: "name", type: "text" },
    { name: "message", type: "textarea" },
    { name: "status", type: "select", required: true, defaultValue: "new",
      options: [
        { label: { en: "New", nl: "Nieuw" }, value: "new" },
        { label: { en: "Read", nl: "Gelezen" }, value: "read" },
        { label: { en: "Contacted", nl: "Contact opgenomen" }, value: "contacted" },
        { label: { en: "Spam", nl: "Spam" }, value: "spam" }
      ]},
    { name: "ipAddress", type: "text",
      access: { read: ({ req }) => req.user?.role === "super-admin" || req.user?.role === "owner" } }
  ],
  hooks: {
    // FN-2026-0060 (audit-4 sister regression of FN-2026-0058) — same
    // cross-tenant FK 500→400 fix shape that fn-batch-7 wired into Pages,
    // Media, SiteSettings. Forms was missed. Translates the missing-
    // tenant case into a clean 400 ValidationError with path:"tenant".
    beforeValidate: [validateTenantExists],
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation === "create") {
          const { captureAcceptedFormAnalytics } = await import("@/lib/analytics/acceptedForm")
          await captureAcceptedFormAnalytics({ doc, payload: req.payload, logger: req.payload.logger })
          await notifyTenantOfFormSubmission({ doc, payload: req.payload as any })
        }
        return doc
      },
    ],
  }
}
