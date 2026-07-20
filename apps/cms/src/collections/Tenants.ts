import type { CollectionConfig, PayloadRequest } from "payload"
import { isSuperAdmin } from "@/access/isSuperAdmin"
import {
  archiveTenantDir,
  clearTenantCookieIfStale,
  createTenantDir,
  enrollTenantAnalytics,
  removeTenantDir,
  restoreTenantDir,
} from "@/hooks/tenantLifecycle"
import { tenantEmailSendingStatuses } from "@/lib/tenants/emailSending"
import { manifestSchema } from "@/lib/richText/manifest"
import { adminText, adminValidationText } from "@/lib/payloadAdminI18n"

// FN-2026-0004 — server-side slug format guard. The /sites/new + /edit
// forms enforce this regex client-side via zod, but a direct PATCH (browser
// console, scripted client, future mobile app) bypassed the rule and
// persisted invalid URL slugs. Mirrors `src/components/forms/TenantForm.tsx`
// + `TenantEditForm.tsx` so the message is consistent everywhere the user
// might see it.
const SLUG_REGEX = /^[a-z0-9-]+$/
const validateSlug = (val: unknown, { req }: { req?: PayloadRequest }) => {
  if (val == null || val === "") return adminValidationText(req?.i18n?.language, "Slug is required", "Slug is verplicht")
  if (typeof val !== "string" || !SLUG_REGEX.test(val)) {
    return adminValidationText(req?.i18n?.language, "Use lowercase letters, digits, and hyphens only", "Gebruik alleen kleine letters, cijfers en koppeltekens")
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
const validateDomain = (val: unknown, { req }: { req?: PayloadRequest }) => {
  const language = req?.i18n?.language
  if (val == null || val === "") return adminValidationText(language, "Domain is required", "Domein is verplicht")
  if (typeof val !== "string") return adminValidationText(language, "Domain must be text", "Domein moet tekst zijn")
  if (val.length > 253) return adminValidationText(language, "Domain is too long (maximum 253 characters)", "Domein is te lang (maximaal 253 tekens)")
  if (!DOMAIN_REGEX.test(val)) {
    return adminValidationText(language, "Use a valid hostname (e.g. clientasite.nl): lowercase letters, digits, hyphens, and at least one dot.", "Gebruik een geldige hostnaam (bijv. clientasite.nl): kleine letters, cijfers, koppeltekens en minimaal één punt.")
  }
  const tld = val.split(".").pop() ?? ""
  if (!/[a-z]/.test(tld)) {
    return adminValidationText(language, "The domain TLD must contain at least one letter (e.g. .com, .nl, .localhost).", "De domeinextensie moet minimaal één letter bevatten (bijv. .com, .nl, .localhost).")
  }
  return true
}

export const Tenants: CollectionConfig = {
  slug: "tenants",
  labels: { singular: { en: "Tenant", nl: "Klantomgeving" }, plural: { en: "Tenants", nl: "Klantomgevingen" } },
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
      admin: { description: adminText("URL-safe ID used in super-admin URLs (/sites/<slug>).", "URL-veilige ID voor superbeheerder-URL's (/sites/<slug>).")} },
    { name: "domain", type: "text", required: true, unique: true, validate: validateDomain,
      admin: { description: adminText("Production domain, e.g. clientasite.nl. Resolved from the Host header.", "Productiedomein, bijv. clientasite.nl. Wordt opgezocht via de Host-header.") } },
    { name: "status", type: "select", required: true, defaultValue: "provisioning",
      options: [
        { label: { en: "Provisioning", nl: "Wordt ingericht" }, value: "provisioning" },
        { label: { en: "Active", nl: "Actief" }, value: "active" },
        { label: { en: "Suspended", nl: "Opgeschort" }, value: "suspended" },
        { label: { en: "Archived", nl: "Gearchiveerd" }, value: "archived" }
      ] },
    { name: "activeSnapshot", type: "relationship", relationTo: "published-site-snapshots",
      admin: { readOnly: true, description: adminText("Published snapshot currently served by the generic renderer.", "Gepubliceerde siteversie die momenteel door de algemene renderer wordt aangeboden.") } },
    { name: "activatedAt", type: "date",
      admin: { readOnly: true, description: adminText("Time this tenant was last activated for live rendering.", "Tijdstip waarop deze klantomgeving voor het laatst voor liveweergave is geactiveerd.") } },
    { name: "domainVerification", type: "group",
      admin: { description: adminText("Manual v1 domain verification status. DNS pointing remains outside automation.", "Handmatige v1-domeinverificatiestatus. DNS-verwijzing valt nog buiten de automatisering.") },
      fields: [
        { name: "status", type: "select", defaultValue: "not_checked",
          options: [
            { label: { en: "Not checked", nl: "Niet gecontroleerd" }, value: "not_checked" },
            { label: { en: "Verified", nl: "Geverifieerd" }, value: "verified" },
            { label: { en: "Failed", nl: "Mislukt" }, value: "failed" }
          ] },
        { name: "checkedAt", type: "date" },
        { name: "checkedBy", type: "relationship", relationTo: "users" },
        { name: "notes", type: "textarea" }
      ] },
    { name: "emailSending", type: "group",
      admin: { description: adminText("Tenant outbound email sender state. Provisioning workers verify this before generated sites can be activated; no secrets are stored here.", "Status van de uitgaande e-mailafzender van de klantomgeving. Inrichtingsworkers controleren dit voordat gegenereerde sites geactiveerd kunnen worden; hier worden geen geheimen opgeslagen.") },
      fields: [
        { name: "provider", type: "select", defaultValue: "cloudflare",
          options: [
            { label: adminText("Cloudflare Email Sending", "Cloudflare Email Sending"), value: "cloudflare" }
          ],
          admin: { description: adminText("Outbound provider for tenant-domain mail.", "Provider voor uitgaande e-mail vanaf het klantdomein.") } },
        { name: "mode", type: "select", defaultValue: "subdomain", index: true,
          options: [
            { label: adminText("Sending subdomain", "Verzendsubdomein"), value: "subdomain" },
            { label: adminText("Apex domain", "Hoofddomein"), value: "apex" }
          ],
          admin: { description: adminText("The normal automated path uses noreply@mail.<tenant-domain>.", "Het normale geautomatiseerde pad gebruikt noreply@mail.<tenant-domain>.") } },
        { name: "status", type: "select", defaultValue: "not_configured", index: true,
          options: tenantEmailSendingStatuses.map((value) => ({
            label: value === "not_configured"
              ? adminText("Not configured", "Niet geconfigureerd")
              : value === "pending"
                ? adminText("Pending verification", "Wacht op verificatie")
                : value === "verified" ? adminText("Verified", "Geverifieerd") : adminText("Failed", "Mislukt"),
            value,
          })),
          admin: { description: adminText("Activation requires verified status before generated-site mail can go live.", "Voor activatie moet de status geverifieerd zijn voordat e-mail van de gegenereerde site live kan gaan.") } },
        { name: "sendingDomain", type: "text", index: true,
          admin: { description: adminText("Cloudflare sending domain, normally mail.<tenant-domain>.", "Cloudflare-verzenddomein, normaal mail.<tenant-domain>.") } },
        { name: "senderEmail", type: "email",
          admin: { description: adminText("From address for tenant customer-facing mail, normally noreply@mail.<tenant-domain>.", "Afzenderadres voor klantgerichte e-mail, normaal noreply@mail.<tenant-domain>.") } },
        { name: "verifiedAt", type: "date",
          admin: { readOnly: true, description: adminText("Set only after provider verification succeeds.", "Wordt alleen ingesteld nadat providerverificatie is geslaagd.") } },
        { name: "lastCheckedAt", type: "date",
          admin: { readOnly: true, description: adminText("Last provisioning/status check time.", "Tijdstip van de laatste inrichtings- of statuscontrole.") } },
        { name: "lastError", type: "textarea",
          admin: { readOnly: true, description: adminText("Last non-secret provider/provisioning error.", "Laatste niet-geheime provider- of inrichtingsfout.") } },
        { name: "cloudflareZoneId", type: "text",
          admin: { readOnly: true, description: adminText("Cloudflare zone identifier for DNS and Email Sending APIs.", "Cloudflare-zone-ID voor DNS- en Email Sending-API's.") } },
        { name: "cloudflareSubdomainId", type: "text",
          admin: { readOnly: true, description: adminText("Cloudflare Email Sending subdomain identifier/tag, when provided by the API.", "Cloudflare Email Sending-subdomein-ID of tag, indien door de API verstrekt.") } },
        { name: "returnPathDomain", type: "text",
          admin: { readOnly: true, description: adminText("Provider return-path/bounce domain, if reported.", "Return-path- of bouncedomein van de provider, indien gemeld.") } },
        { name: "dkimSelector", type: "text",
          admin: { readOnly: true, description: adminText("Provider DKIM selector, if reported.", "DKIM-selector van de provider, indien gemeld.") } },
        { name: "testMessageId", type: "text",
          admin: { readOnly: true, description: adminText("Provider message ID from the latest controlled verification test.", "Bericht-ID van de provider uit de laatste gecontroleerde verificatietest.") } }
      ] },
    { name: "siteRepo", type: "text", admin: { description: adminText("Optional GitHub source for siteManifest.json, e.g. Optidigi/client-site.", "Optionele GitHub-bron voor siteManifest.json, bijv. Optidigi/client-site.") } },
    { name: "notes", type: "textarea" },
    { name: "siteManifest", type: "json", required: false,
      admin: {
        description: adminText("Per-tenant rich-text editor configuration. JSON is validated against the RtManifest schema.", "Rich-text-editorconfiguratie per klantomgeving. JSON wordt gevalideerd tegen het RtManifest-schema."),
      },
      validate: (val: unknown, { req }: { req?: PayloadRequest }) => {
        if (val == null) return true
        const r = manifestSchema.safeParse(val)
        if (r.success) return true
        const msg = r.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")
        return adminValidationText(req?.i18n?.language, `siteManifest is invalid — ${msg}`, `siteManifest is ongeldig — ${msg}`)
      },
    },
    { name: "theme", type: "json", required: false,
      admin: {
        description: adminText("Tenant design-token overrides set via the canvas theme bar.", "Design-tokenoverschrijvingen voor de klantomgeving, ingesteld via de canvasthemabalk."),
      },
    },
  ],
  hooks: {
    afterChange: [createTenantDir, archiveTenantDir, restoreTenantDir, enrollTenantAnalytics],
    afterDelete: [removeTenantDir, clearTenantCookieIfStale]
  }
}
