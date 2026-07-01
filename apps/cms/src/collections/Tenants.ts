import type { CollectionConfig } from "payload"
import { isSuperAdmin } from "@/access/isSuperAdmin"
import {
  archiveTenantDir,
  clearTenantCookieIfStale,
  createTenantDir,
  projectThemeOnChange,
  removeTenantDir,
  restoreTenantDir
} from "@/hooks/tenantLifecycle"
import { tenantEmailSendingStatuses } from "@/lib/tenants/emailSending"
import { manifestSchema } from "@/lib/richText/manifest"

// FN-2026-0004 — server-side slug format guard. The /sites/new + /edit
// forms enforce this regex client-side via zod, but a direct PATCH (browser
// console, scripted client, future mobile app) bypassed the rule and
// persisted invalid URL slugs. Mirrors `src/components/forms/TenantForm.tsx`
// + `TenantEditForm.tsx` so the message is consistent everywhere the user
// might see it.
const SLUG_REGEX = /^[a-z0-9-]+$/
const validateSlug = (val: unknown) => {
  if (val == null || val === "") return "Slug is required"
  if (typeof val !== "string" || !SLUG_REGEX.test(val)) {
    return "Lowercase, digits, hyphens only"
  }
  return true
}

// FN-2026-0033 — server-side domain format guard. Pre-fix POST /api/tenants
// with `{"domain":"not a domain at all"}` returned 201 and persisted the
// literal string; every routing surface that constructs `https://${tenant
// .domain}` then yielded a broken URL with no diagnostic. Validate as a
// permissive hostname pattern: lowercase ASCII letters/digits/hyphens
// separated by dots, at least one dot, no leading/trailing dot or hyphen.
// This accepts production-style domains (clientasite.nl, sub.example.com)
// AND .localhost / .test dev fixtures (audit.localhost, foo.test).
//
// fn-batch-6 follow-up — also reject all-numeric TLDs (e.g. 1.2.3.4).
// RFC 1123 / RFC 3696 require the right-most label to contain at least
// one alphabetic character; the prior regex would have accepted "1.2"
// or "1.2.3.4" as valid hostnames, which would silently never match a
// real Host header lookup.
const DOMAIN_REGEX = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/
const validateDomain = (val: unknown) => {
  if (val == null || val === "") return "Domain is required"
  if (typeof val !== "string") return "Domain must be a string"
  if (val.length > 253) return "Domain too long (max 253 chars)"
  if (!DOMAIN_REGEX.test(val)) {
    return "Use a valid hostname (e.g. clientasite.nl). Lowercase letters, digits, hyphens; at least one dot."
  }
  const tld = val.split(".").pop() ?? ""
  if (!/[a-z]/.test(tld)) {
    return "Domain TLD must contain at least one letter (e.g. .com, .nl, .localhost)."
  }
  return true
}

export const Tenants: CollectionConfig = {
  slug: "tenants",
  access: {
    create: isSuperAdmin,
    read: isSuperAdmin,
    update: isSuperAdmin,
    delete: isSuperAdmin
  },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "domain", "status", "emailSending.status", "emailSending.mode", "emailSending.sendingDomain"],
    listSearchableFields: ["name", "slug", "domain", "emailSending.sendingDomain"],
  },
  fields: [
    { name: "name", type: "text", required: true },
    { name: "slug", type: "text", required: true, unique: true, validate: validateSlug,
      admin: { description: "URL-safe id used in super-admin URLs (/sites/<slug>)" } },
    { name: "domain", type: "text", required: true, unique: true, validate: validateDomain,
      admin: { description: "Production domain, e.g. clientasite.nl. Looked up from Host header." } },
    { name: "status", type: "select", required: true, defaultValue: "provisioning",
      options: [
        { label: "Provisioning", value: "provisioning" },
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Archived", value: "archived" }
      ] },
    { name: "activeSnapshot", type: "relationship", relationTo: "published-site-snapshots",
      admin: { readOnly: true, description: "Published snapshot currently served by the generic renderer." } },
    { name: "activatedAt", type: "date",
      admin: { readOnly: true, description: "Time this tenant was last activated for live rendering." } },
    { name: "domainVerification", type: "group",
      admin: { description: "Manual v1 domain verification status. DNS pointing remains outside automation." },
      fields: [
        { name: "status", type: "select", defaultValue: "not_checked",
          options: [
            { label: "Not checked", value: "not_checked" },
            { label: "Verified", value: "verified" },
            { label: "Failed", value: "failed" }
          ] },
        { name: "checkedAt", type: "date" },
        { name: "checkedBy", type: "relationship", relationTo: "users" },
        { name: "notes", type: "textarea" }
      ] },
    { name: "emailSending", type: "group",
      admin: { description: "Tenant outbound email sender state. Provisioning workers verify this before generated sites can be activated; no secrets are stored here." },
      fields: [
        { name: "provider", type: "select", defaultValue: "cloudflare",
          options: [
            { label: "Cloudflare Email Sending", value: "cloudflare" }
          ],
          admin: { description: "Outbound provider for tenant-domain mail." } },
        { name: "mode", type: "select", defaultValue: "subdomain", index: true,
          options: [
            { label: "Sending subdomain", value: "subdomain" },
            { label: "Apex domain", value: "apex" }
          ],
          admin: { description: "Normal automated path uses noreply@mail.<tenant-domain>." } },
        { name: "status", type: "select", defaultValue: "not_configured", index: true,
          options: tenantEmailSendingStatuses.map((value) => ({
            label: value === "not_configured"
              ? "Not configured"
              : value === "pending"
                ? "Pending verification"
                : value[0]!.toUpperCase() + value.slice(1),
            value,
          })),
          admin: { description: "Activation will require verified before normal generated-site mail can go live." } },
        { name: "sendingDomain", type: "text", index: true,
          admin: { description: "Cloudflare sending domain, normally mail.<tenant-domain>." } },
        { name: "senderEmail", type: "email",
          admin: { description: "From address for tenant customer-facing mail, normally noreply@mail.<tenant-domain>." } },
        { name: "verifiedAt", type: "date",
          admin: { readOnly: true, description: "Set only after provider verification succeeds." } },
        { name: "lastCheckedAt", type: "date",
          admin: { readOnly: true, description: "Last provisioning/status check time." } },
        { name: "lastError", type: "textarea",
          admin: { readOnly: true, description: "Last non-secret provider/provisioning error." } },
        { name: "cloudflareZoneId", type: "text",
          admin: { readOnly: true, description: "Cloudflare zone identifier for DNS and Email Sending APIs." } },
        { name: "cloudflareSubdomainId", type: "text",
          admin: { readOnly: true, description: "Cloudflare Email Sending subdomain identifier/tag, when provided by the API." } },
        { name: "returnPathDomain", type: "text",
          admin: { readOnly: true, description: "Provider return-path/bounce domain, if reported." } },
        { name: "dkimSelector", type: "text",
          admin: { readOnly: true, description: "Provider DKIM selector, if reported." } },
        { name: "testMessageId", type: "text",
          admin: { readOnly: true, description: "Provider message id from the latest controlled verification test." } }
      ] },
    { name: "siteRepo", type: "text", admin: { description: "Optional GitHub source for siteManifest.json, e.g. Optidigi/client-site" } },
    { name: "notes", type: "textarea" },
    { name: "siteManifest", type: "json", required: false,
      admin: {
        description: "Per-tenant rich-text editor configuration. JSON validated against RtManifest schema (src/lib/richText/manifest.ts).",
      },
      validate: (val: unknown) => {
        if (val == null) return true
        const r = manifestSchema.safeParse(val)
        if (r.success) return true
        const msg = r.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")
        return `siteManifest invalid — ${msg}`
      },
    },
    { name: "theme", type: "json", required: false,
      admin: {
        description: "Tenant design-token overrides set via the canvas theme bar.",
      },
    },
  ],
  hooks: {
    afterChange: [createTenantDir, archiveTenantDir, restoreTenantDir, projectThemeOnChange],
    afterDelete: [removeTenantDir, clearTenantCookieIfStale]
  }
}
