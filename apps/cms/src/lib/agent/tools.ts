import type { Payload } from "payload"
import {
  AppointmentScheduleSettingsSchema,
  BACKGROUND_MODE_IDS,
  DEFAULT_APPOINTMENT_SCHEDULE,
  NAVBAR_PLACEMENTS,
  ThemeTokenSpecSchema,
  type AppointmentScheduleSettings,
  type SitegenBlockType,
  type ThemeTokenSpec,
} from "@siteinabox/contracts"
import { isLiveCatalogBlockType, isUnavailableCatalogBlockType } from "@/lib/builder/catalogHonesty"
import { sitegenFooterFor, sitegenNavbarFor, sitegenVariantFor } from "@/lib/sitegen/catalog"
import { themeSchema } from "@/lib/theme/schema"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"
import type { Page, SiteSetting, Tenant, User } from "@/payload-types"

export type AgentWriteContext = {
  payload: Payload
  tenantId: string | number
  user?: User | null
}

const collectionWrite = (ctx: AgentWriteContext): { overrideAccess: boolean; user?: User } =>
  ctx.user
    ? { overrideAccess: false, user: ctx.user }
    : { overrideAccess: true }

const WEEKDAY_WINDOWS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const

const findTenantSettings = async (ctx: AgentWriteContext): Promise<SiteSetting | undefined> => {
  const found = await ctx.payload.find({
    collection: "site-settings",
    where: { tenant: { equals: ctx.tenantId } },
    limit: 1,
    depth: 0,
    ...collectionWrite(ctx),
  })
  return found.docs[0] as SiteSetting | undefined
}

const findPageBySlug = async (ctx: AgentWriteContext, pageSlug: string): Promise<Page | undefined> => {
  const found = await ctx.payload.find({
    collection: "pages",
    where: {
      and: [
        { tenant: { equals: ctx.tenantId } },
        { slug: { equals: pageSlug } },
      ],
    },
    limit: 1,
    depth: 0,
    ...collectionWrite(ctx),
  })
  return found.docs[0] as Page | undefined
}

export const defaultEnabledAppointments = (): AppointmentScheduleSettings => ({
  ...DEFAULT_APPOINTMENT_SCHEDULE,
  enabled: true,
  weeklyAvailability: WEEKDAY_WINDOWS.map((weekday) => ({
    weekday,
    windows: [{ start: "09:00", end: "17:00" }],
  })),
})

export const setTheme = async (ctx: AgentWriteContext, theme: ThemeTokenSpec): Promise<ThemeTokenSpec> => {
  const parsed = ThemeTokenSpecSchema.safeParse(theme)
  if (!parsed.success) throw new Error(`Invalid theme: ${parsed.error.message}`)
  const cmsTheme = themeSchema.parse(parsed.data)
  await ctx.payload.update({
    collection: "tenants",
    id: ctx.tenantId,
    data: { theme: cmsTheme },
    depth: 0,
    overrideAccess: true,
  })
  return parsed.data
}

export const setAppointments = async (
  ctx: AgentWriteContext,
  schedule: AppointmentScheduleSettings = defaultEnabledAppointments(),
): Promise<AppointmentScheduleSettings> => {
  const parsed = AppointmentScheduleSettingsSchema.parse(schedule)
  const existing = await findTenantSettings(ctx)
  if (!existing) throw new Error("Site settings not found for tenant.")
  await ctx.payload.update({
    collection: "site-settings",
    id: existing.id,
    data: { appointments: parsed },
    depth: 0,
    ...collectionWrite(ctx),
  })
  return parsed
}

export const setContact = async (
  ctx: AgentWriteContext,
  contact: { phone?: string | null; address?: string | null },
): Promise<void> => {
  const existing = await findTenantSettings(ctx)
  if (!existing) throw new Error("Site settings not found for tenant.")
  await ctx.payload.update({
    collection: "site-settings",
    id: existing.id,
    data: {
      contact: {
        phone: contact.phone ?? null,
        address: contact.address ?? null,
        social: Array.isArray(existing.contact) ? [] : (existing.contact?.social ?? []),
      },
    },
    depth: 0,
    ...collectionWrite(ctx),
  })
}

export const updateSectionProps = async (
  ctx: AgentWriteContext,
  input: { pageSlug: string; blockIndex?: number | null; field: "heading" | "body"; value: string },
): Promise<void> => {
  const page = await findPageBySlug(ctx, input.pageSlug)
  if (!page) throw new Error("Page not found for tenant.")
  const blocks = Array.isArray(page.blocks) ? [...page.blocks] : []
  const index = input.blockIndex != null && input.blockIndex >= 0 && input.blockIndex < blocks.length
    ? input.blockIndex
    : 0
  const block = blocks[index]
  if (!block || typeof block !== "object") throw new Error("Selected block is missing.")
  blocks[index] = { ...block, [input.field]: input.value }
  await ctx.payload.update({
    collection: "pages",
    id: page.id,
    data: { blocks },
    depth: 0,
    ...collectionWrite(ctx),
  })
}

export const setHours = async (
  ctx: AgentWriteContext,
  hours: Array<{ day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"; open: string | null; close: string | null; closed?: boolean }>,
): Promise<void> => {
  const existing = await findTenantSettings(ctx)
  if (!existing) throw new Error("Site settings not found for tenant.")
  await ctx.payload.update({
    collection: "site-settings",
    id: existing.id,
    data: { hours },
    depth: 0,
    ...collectionWrite(ctx),
  })
}

const catalogBlockTypeFromVariant = (variant: string): SitegenBlockType | null => {
  const prefix = variant.split("-")[0]
  if (prefix === "hero" || prefix === "services" || prefix === "cta" || prefix === "appointments") {
    return prefix
  }
  return null
}

export const replaceSection = async (
  ctx: AgentWriteContext,
  input: { pageSlug: string; blockIndex?: number | null; variant: string },
): Promise<void> => {
  const blockType = catalogBlockTypeFromVariant(input.variant)
  if (!blockType || !sitegenVariantFor(blockType, input.variant)) {
    throw new Error("That section design is not in the Sitegen catalog.")
  }
  const page = await findPageBySlug(ctx, input.pageSlug)
  if (!page) throw new Error("Page not found for tenant.")
  const blocks = Array.isArray(page.blocks) ? [...page.blocks] : []
  const preferred = input.blockIndex != null && input.blockIndex >= 0 && input.blockIndex < blocks.length
    ? input.blockIndex
    : blocks.findIndex((block) => typeof block === "object" && block !== null && "blockType" in block && block.blockType === blockType)
  const index = preferred >= 0 ? preferred : 0
  const current = blocks[index]
  if (!current || typeof current !== "object") throw new Error("Selected block is missing.")
  const record = current as unknown as Record<string, unknown>
  blocks[index] = {
    ...record,
    blockType,
    variant: input.variant,
  } as typeof current
  await ctx.payload.update({
    collection: "pages",
    id: page.id,
    data: { blocks },
    depth: 0,
    ...collectionWrite(ctx),
  })
}

export const loadTenantById = async (payload: Payload, id: string | number): Promise<Tenant | undefined> => {
  try {
    return await payload.findByID({
      collection: "tenants",
      id,
      depth: 0,
      overrideAccess: true,
    }) as Tenant
  } catch {
    return undefined
  }
}

export const loadTenantBySlug = async (payload: Payload, slug: string): Promise<Tenant | undefined> => {
  const found = await payload.find({
    collection: "tenants",
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return found.docs[0] as Tenant | undefined
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const BLOCK_PATCH_KEYS = [
  "heading",
  "body",
  "intro",
  "primaryAction",
  "secondaryAction",
  "backgroundMode",
  "highlights",
  "items",
  "anchor",
] as const

export type BlockPatch = Partial<{
  heading: string
  body: string
  intro: string | null
  primaryAction: { label: string; href: string } | null
  secondaryAction: { label: string; href: string } | null
  backgroundMode: (typeof BACKGROUND_MODE_IDS)[number] | null
  highlights: Array<{ title: string; body: string }>
  items: Array<{ title: string; body: string; action?: { label: string; href: string } | null }>
  anchor: string | null
}>

export type SiteEditorSnapshot = {
  theme: ThemeTokenSpec | null
  page: {
    id: string | number
    slug: string
    title: string
    updatedAt: string
    seo: { title?: string | null; description?: string | null }
    blocks: unknown[]
  } | null
  chrome: {
    navbarVariant: string | null
    navbarPlacement: string | null
    footerVariant: string | null
    footerTagline: string | null
  }
  contact: { phone: string | null; address: string | null }
  appointmentsEnabled: boolean
}

export const compactBlockForModel = (block: unknown, index: number): Record<string, unknown> => {
  if (!isRecord(block)) return { index, missing: true }
  const items = Array.isArray(block.items)
    ? block.items.flatMap((item) => isRecord(item) && typeof item.title === "string" ? [item.title] : [])
    : undefined
  const highlights = Array.isArray(block.highlights)
    ? block.highlights.flatMap((item) => isRecord(item) && typeof item.title === "string" ? [item.title] : [])
    : undefined
  return {
    index,
    blockType: block.blockType ?? null,
    variant: block.variant ?? null,
    heading: block.heading ?? null,
    body: block.body ?? null,
    intro: block.intro ?? null,
    backgroundMode: block.backgroundMode ?? null,
    primaryAction: block.primaryAction ?? null,
    secondaryAction: block.secondaryAction ?? null,
    itemTitles: items,
    highlightTitles: highlights,
    live: isLiveCatalogBlockType(block.blockType),
  }
}

export const loadSiteSnapshot = async (
  ctx: AgentWriteContext,
  pageSlug: string,
): Promise<SiteEditorSnapshot> => {
  const tenant = await loadTenantById(ctx.payload, ctx.tenantId)
  const page = await findPageBySlug(ctx, pageSlug)
  const settings = await findTenantSettings(ctx)
  const chrome = settings?.chrome
  const contact = settings?.contact
  return {
    theme: normalizeThemeForSave(tenant?.theme ?? null),
    page: page
      ? {
          id: page.id,
          slug: page.slug,
          title: page.title,
          updatedAt: page.updatedAt,
          seo: {
            title: page.seo?.title ?? null,
            description: page.seo?.description ?? null,
          },
          blocks: Array.isArray(page.blocks) ? page.blocks : [],
        }
      : null,
    chrome: {
      navbarVariant: chrome?.navbar?.variant ?? null,
      navbarPlacement: chrome?.navbar?.placement ?? null,
      footerVariant: chrome?.footer?.variant ?? null,
      footerTagline: chrome?.footer?.tagline ?? null,
    },
    contact: {
      phone: typeof contact === "object" && contact && !Array.isArray(contact) ? contact.phone ?? null : null,
      address: typeof contact === "object" && contact && !Array.isArray(contact) ? contact.address ?? null : null,
    },
    appointmentsEnabled: Boolean(settings?.appointments?.enabled),
  }
}

export const patchSection = async (
  ctx: AgentWriteContext,
  input: { pageSlug: string; blockIndex?: number | null; patch: BlockPatch },
): Promise<void> => {
  const page = await findPageBySlug(ctx, input.pageSlug)
  if (!page) throw new Error("Page not found for tenant.")
  const blocks = Array.isArray(page.blocks) ? [...page.blocks] : []
  const index = input.blockIndex != null && input.blockIndex >= 0 && input.blockIndex < blocks.length
    ? input.blockIndex
    : 0
  const block = blocks[index]
  if (!block || typeof block !== "object") throw new Error("Selected block is missing.")
  const record = block as unknown as Record<string, unknown>
  if (isUnavailableCatalogBlockType(record.blockType)) {
    throw new Error("This section is not in the live catalog. Remove it instead of editing copy.")
  }
  const next = { ...record }
  for (const key of BLOCK_PATCH_KEYS) {
    if (input.patch[key] !== undefined) {
      next[key] = input.patch[key]
    }
  }
  if (next.backgroundMode === "image" && next.image == null) {
    throw new Error("An image background needs an existing image on this block. Choose another backgroundMode.")
  }
  blocks[index] = next as never
  await ctx.payload.update({
    collection: "pages",
    id: page.id,
    data: { blocks },
    depth: 0,
    ...collectionWrite(ctx),
  })
}

export const pruneUnavailableBlocksIfPresent = async (
  ctx: AgentWriteContext,
  pageSlug: string,
): Promise<{ removed: number; remaining: number }> => {
  const page = await findPageBySlug(ctx, pageSlug)
  if (!page) return { removed: 0, remaining: 0 }
  const blocks = Array.isArray(page.blocks) ? page.blocks : []
  if (!blocks.some((block) => isRecord(block) && isUnavailableCatalogBlockType(block.blockType))) {
    return { removed: 0, remaining: blocks.length }
  }
  return removeUnavailableBlocks(ctx, pageSlug)
}

export const removeUnavailableBlocks = async (
  ctx: AgentWriteContext,
  pageSlug: string,
): Promise<{ removed: number; remaining: number }> => {
  const page = await findPageBySlug(ctx, pageSlug)
  if (!page) throw new Error("Page not found for tenant.")
  const blocks = Array.isArray(page.blocks) ? [...page.blocks] : []
  const next = blocks.filter((block) => {
    if (!isRecord(block)) return true
    return !isUnavailableCatalogBlockType(block.blockType)
  })
  const removed = blocks.length - next.length
  if (removed === 0) return { removed: 0, remaining: next.length }
  if (next.length === 0) {
    throw new Error("I will not empty the page. Keep at least one live catalog section.")
  }
  await ctx.payload.update({
    collection: "pages",
    id: page.id,
    data: { blocks: next },
    depth: 0,
    ...collectionWrite(ctx),
  })
  return { removed, remaining: next.length }
}

export const setChrome = async (
  ctx: AgentWriteContext,
  input: {
    navbarVariant?: string | null
    navbarPlacement?: (typeof NAVBAR_PLACEMENTS)[number] | null
    footerVariant?: string | null
    footerTagline?: string | null
  },
): Promise<void> => {
  if (input.navbarVariant && !sitegenNavbarFor(input.navbarVariant)) {
    throw new Error("That navbar design is not in the live catalog.")
  }
  if (input.footerVariant && !sitegenFooterFor(input.footerVariant)) {
    throw new Error("That footer design is not in the live catalog.")
  }
  const existing = await findTenantSettings(ctx)
  if (!existing) throw new Error("Site settings not found for tenant.")
  const chrome = existing.chrome
  await ctx.payload.update({
    collection: "site-settings",
    id: existing.id,
    data: {
      chrome: {
        ...chrome,
        navbar: {
          ...chrome.navbar,
          ...(input.navbarVariant
            ? { variant: input.navbarVariant as SiteSetting["chrome"]["navbar"]["variant"] }
            : {}),
          ...(input.navbarPlacement ? { placement: input.navbarPlacement } : {}),
        },
        footer: {
          ...chrome.footer,
          ...(input.footerVariant
            ? { variant: input.footerVariant as SiteSetting["chrome"]["footer"]["variant"] }
            : {}),
          ...(input.footerTagline !== undefined ? { tagline: input.footerTagline } : {}),
        },
      },
    },
    depth: 0,
    ...collectionWrite(ctx),
  })
}

export const setSeo = async (
  ctx: AgentWriteContext,
  input: { pageSlug: string; title?: string | null; description?: string | null },
): Promise<void> => {
  const page = await findPageBySlug(ctx, input.pageSlug)
  if (!page) throw new Error("Page not found for tenant.")
  await ctx.payload.update({
    collection: "pages",
    id: page.id,
    data: {
      seo: {
        title: input.title !== undefined ? input.title : page.seo?.title ?? null,
        description: input.description !== undefined ? input.description : page.seo?.description ?? null,
        ogImage: page.seo?.ogImage ?? null,
      },
    },
    depth: 0,
    ...collectionWrite(ctx),
  })
}
