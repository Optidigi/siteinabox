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
  admin: { useAsTitle: "name", defaultColumns: ["name", "domain", "status"] },
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
    { name: "siteRepo", type: "text", admin: { description: "GitHub source for siteManifest.json, e.g. Optidigi/siteinabox:sites/clientasite" } },
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
