import type { CollectionConfig, JSONFieldValidation } from "payload"
import { canRead, canWrite } from "@/access/roleHelpers"
import { hasUnvalidatedAuthSignal } from "@/access/authSignals"
import { validateTenantExists } from "@/hooks/validateTenantExists"

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

const validateFormData: JSONFieldValidation = (value) => {
  const serialised = JSON.stringify(value ?? {})
  if (serialised.length > MAX_FORM_DATA_BYTES) {
    return `data exceeds ${MAX_FORM_DATA_BYTES}-byte cap (got ${serialised.length} bytes)`
  }
  return true
}

export const Forms: CollectionConfig = {
  slug: "forms",
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
    description: "Submissions inbox. Created by public form posts; managed by tenant editors."
  },
  fields: [
    { name: "formName", type: "text", required: true },
    { name: "pageUrl", type: "text" },
    { name: "data", type: "json", required: true, validate: validateFormData,
      admin: { description: "Full submission payload as posted (max 32 KB)" } },
    { name: "email", type: "text" },
    { name: "name", type: "text" },
    { name: "message", type: "textarea" },
    { name: "status", type: "select", required: true, defaultValue: "new",
      options: [
        { label: "New", value: "new" },
        { label: "Read", value: "read" },
        { label: "Contacted", value: "contacted" },
        { label: "Spam", value: "spam" }
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
        }
        return doc
      },
    ],
  }
}
