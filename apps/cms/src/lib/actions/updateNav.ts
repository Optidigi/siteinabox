"use server"
import { headers } from "next/headers"
import { getPayload } from "payload"
import { z } from "zod"
import type { SiteSetting } from "@/payload-types"
import config from "@/payload.config"

// OBS-20 — persist a tenant's header + footer navigation.
//
// Unlike setTenantTheme (which works around a too-strict `Tenants` gate),
// `SiteSettings.access.update` is already `canUpdateSettings` (owner +
// super-admin) and the multi-tenant plugin scopes the update to the
// caller's own tenant. So this action takes the AGENTS.md-preferred path:
// `overrideAccess: false, user: caller` — Payload's collection access +
// field-level `validate` functions are the authorization + integrity gate.
// An editor/viewer (or a wrong-tenant owner) is rejected by Payload itself.

const navEntrySchema = z.object({
  type: z.enum(["page", "section", "custom", "group"]),
  page: z.union([z.number(), z.string()]).nullish(),
  anchor: z.string().nullish(),
  url: z.string().nullish(),
  label: z.string().nullish(),
  external: z.boolean().nullish(),
  description: z.string().trim().max(90).nullish(),
  children: z.array(z.object({
    label: z.string().trim().min(1).max(32),
    href: z.string().trim().min(1),
    description: z.string().trim().max(90).nullish(),
    icon: z.enum(["backpack", "cake-slice", "coffee", "grape", "hotel", "ice-cream", "map-pin", "package", "pizza", "plane", "sandwich", "smile"]).nullish(),
    external: z.boolean(),
  })).max(6).optional(),
})
// Coarse shape check only — the per-type required-field rules (page link
// needs `page`, section needs `anchor`+`label`, etc.) are enforced by the
// `validate` functions on the SiteSettings nav fields, which run inside
// `payload.update` below.
const navListSchema = z.array(navEntrySchema)

export type NavEntryInput = z.infer<typeof navEntrySchema>

export const updateNav = async (
  tenantId: number | string,
  nav: { navHeader: unknown; navFooter: unknown },
): Promise<void> => {
  const header = navListSchema.safeParse(nav.navHeader)
  const footer = navListSchema.safeParse(nav.navFooter)
  if (!header.success) throw new Error(`Invalid header navigation: ${header.error.message}`)
  if (!footer.success) throw new Error(`Invalid footer navigation: ${footer.error.message}`)

  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) throw new Error("Forbidden: authentication required")

  // Resolve the tenant's site-settings row scoped to the caller — for a
  // tenant owner the multi-tenant plugin only returns their own tenant's
  // settings, so a mismatched tenantId yields no row (clean implicit guard).
  const found = await payload.find({
    collection: "site-settings",
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    user,
    overrideAccess: false,
  })
  const settings = found.docs[0]
  if (!settings) throw new Error("Forbidden: no site settings accessible for this tenant")

  await payload.update({
    collection: "site-settings",
    id: settings.id,
    data: { navHeader: header.data, navFooter: footer.data } as Partial<SiteSetting>,
    user,
    overrideAccess: false,
  })
}
