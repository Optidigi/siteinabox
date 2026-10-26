import type { MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

type Database = MigrateUpArgs["db"]
type JsonRecord = Record<string, unknown>

const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)

const rowsFrom = <T,>(value: unknown): T[] => {
  if (!isRecord(value) || !Array.isArray(value.rows)) return []
  return value.rows as T[]
}

const jsonValue = (value: unknown): unknown => {
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

/**
 * These are the relational block tables that existed before the first-party
 * block cutover. The first migration stages their complete rows before the
 * generated DDL drops or reshapes them. Keeping the list here makes the
 * migration's preservation boundary explicit and reviewable.
 */
export const LEGACY_BLOCK_PARENT_TABLES = [
  "pages_blocks_hero",
  "pages_blocks_hero_minimal",
  "pages_blocks_hero_split",
  "pages_blocks_hero_portrait",
  "pages_blocks_hero_band",
  "pages_blocks_hero_card",
  "pages_blocks_hero_editorial",
  "pages_blocks_hero_framed",
  "pages_blocks_hero_angled",
  "pages_blocks_hero_edge",
  "pages_blocks_hero_cover_panel",
  "pages_blocks_hero_image_below",
  "pages_blocks_hero_image_first",
  "pages_blocks_hero_rail",
  "pages_blocks_hero_color_field",
  "pages_blocks_hero_color_image",
  "pages_blocks_hero_photo_stage",
  "pages_blocks_hero_pattern_split",
  "pages_blocks_hero_pattern_band",
  "pages_blocks_hero_showcase",
  "pages_blocks_hero_cover_actions",
  "pages_blocks_hero_service_mosaic",
  "pages_blocks_hero_service_panel",
  "pages_blocks_feature_list",
  "pages_blocks_testimonials",
  "pages_blocks_faq",
  "pages_blocks_cta",
  "pages_blocks_pricing",
  "pages_blocks_contact_section",
  "pages_blocks_contact_details",
  "pages_blocks_gallery",
  "pages_blocks_timeline",
  "pages_blocks_stats",
  "pages_blocks_logo_cloud",
  "pages_blocks_team",
  "pages_blocks_newsletter",
  "pages_blocks_bento_grid",
  "pages_blocks_content_section",
  "pages_blocks_blog_cards",
  "pages_blocks_rich_text",
  "pages_blocks_media_hero",
  "pages_blocks_info_card_list",
  "pages_blocks_service_carousel",
  "pages_blocks_before_after_gallery",
] as const

export const LEGACY_BLOCK_CHILD_TABLES = [
  "pages_blocks_hero_pills",
  "pages_blocks_hero_links",
  "pages_blocks_hero_stats",
  "pages_blocks_hero_logos",
  "pages_blocks_hero_angled_highlights",
  "pages_blocks_hero_split_highlights",
  "pages_blocks_hero_highlights",
  "pages_blocks_hero_service_mosaic_service_highlights",
  "pages_blocks_hero_service_panel_service_highlights",
  "pages_blocks_feature_list_features",
  "pages_blocks_testimonials_items",
  "pages_blocks_faq_items",
  "pages_blocks_contact_section_fields",
  "pages_blocks_contact_section_fields_options",
  "pages_blocks_contact_section_provider_hidden_fields",
  "pages_blocks_contact_details_items",
  "pages_blocks_gallery_images",
  "pages_blocks_timeline_items",
  "pages_blocks_timeline_items_tags",
  "pages_blocks_pricing_plans",
  "pages_blocks_pricing_plans_features",
  "pages_blocks_stats_items",
  "pages_blocks_logo_cloud_logos",
  "pages_blocks_team_members",
  "pages_blocks_team_members_links",
  "pages_blocks_newsletter_benefits",
  "pages_blocks_bento_grid_items",
  "pages_blocks_content_section_features",
  "pages_blocks_blog_cards_posts",
  "pages_blocks_info_card_list_items",
  "pages_blocks_service_carousel_items",
  "pages_blocks_before_after_gallery_pairs",
] as const

export const LEGACY_BLOCK_TABLES = [
  ...LEGACY_BLOCK_CHILD_TABLES,
  ...LEGACY_BLOCK_PARENT_TABLES,
] as const

const LEGACY_TABLES_REMAINING_AFTER_FIRST_DDL = LEGACY_BLOCK_TABLES.filter((table) =>
  ![
    "pages_blocks_hero",
    // Recreated as a canonical Hero child table by the canonical hero
    // migration. Keep it available for the final staged-data restoration.
    "pages_blocks_hero_highlights",
    "pages_blocks_faq",
    "pages_blocks_faq_items",
    "pages_blocks_cta",
    "pages_blocks_pricing",
  ].includes(table),
)

const childParentSource: Record<string, string> = {
  pages_blocks_hero_pills: "pages_blocks_hero",
  pages_blocks_hero_links: "pages_blocks_hero",
  pages_blocks_hero_stats: "pages_blocks_hero",
  pages_blocks_hero_logos: "pages_blocks_hero",
  pages_blocks_hero_angled_highlights: "pages_blocks_hero_angled",
  pages_blocks_hero_split_highlights: "pages_blocks_hero_split",
  pages_blocks_hero_highlights: "pages_blocks_hero",
  pages_blocks_hero_service_mosaic_service_highlights: "pages_blocks_hero_service_mosaic",
  pages_blocks_hero_service_panel_service_highlights: "pages_blocks_hero_service_panel",
  pages_blocks_feature_list_features: "pages_blocks_feature_list",
  pages_blocks_testimonials_items: "pages_blocks_testimonials",
  pages_blocks_faq_items: "pages_blocks_faq",
  pages_blocks_contact_section_fields: "pages_blocks_contact_section",
  pages_blocks_contact_section_fields_options: "pages_blocks_contact_section_fields",
  pages_blocks_contact_section_provider_hidden_fields: "pages_blocks_contact_section_fields",
  pages_blocks_contact_details_items: "pages_blocks_contact_details",
  pages_blocks_gallery_images: "pages_blocks_gallery",
  pages_blocks_timeline_items: "pages_blocks_timeline",
  pages_blocks_timeline_items_tags: "pages_blocks_timeline_items",
  pages_blocks_pricing_plans: "pages_blocks_pricing",
  pages_blocks_pricing_plans_features: "pages_blocks_pricing_plans",
  pages_blocks_stats_items: "pages_blocks_stats",
  pages_blocks_logo_cloud_logos: "pages_blocks_logo_cloud",
  pages_blocks_team_members: "pages_blocks_team",
  pages_blocks_team_members_links: "pages_blocks_team_members",
  pages_blocks_newsletter_benefits: "pages_blocks_newsletter",
  pages_blocks_bento_grid_items: "pages_blocks_bento_grid",
  pages_blocks_content_section_features: "pages_blocks_content_section",
  pages_blocks_blog_cards_posts: "pages_blocks_blog_cards",
  pages_blocks_info_card_list_items: "pages_blocks_info_card_list",
  pages_blocks_service_carousel_items: "pages_blocks_service_carousel",
  pages_blocks_before_after_gallery_pairs: "pages_blocks_before_after_gallery",
}

const sqlStringArray = (values: readonly string[]): string =>
  `ARRAY[${values.map((value) => `'${value}'`).join(", ")}]`

/**
 * Stage all old rows in one temporary-to-the-migration table. The table is
 * intentionally durable across migration boundaries: 193845 creates it,
 * later migrations restore from it after the final enum/table shapes exist.
 */
export async function stageLegacyRelationalBlocks(db: Database): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS public.sitegen_legacy_block_stage (
      stage_id bigserial PRIMARY KEY,
      source_table varchar NOT NULL,
      row_kind varchar NOT NULL,
      block_order integer NOT NULL,
      page_id integer,
      parent_id varchar NOT NULL,
      data jsonb NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sitegen_legacy_block_stage_parent_idx
      ON public.sitegen_legacy_block_stage (source_table, row_kind, parent_id);
  `)

  const existing = await db.execute(sql`
    SELECT count(*)::int AS count
    FROM public.sitegen_legacy_block_stage;
  `)
  const existingCount = Number(rowsFrom<{ count: number | string }>(existing)[0]?.count ?? 0)
  if (existingCount > 0) {
    throw new Error(
      `The legacy block staging table already contains ${existingCount} row(s). Restore or inspect that staged migration before retrying the cutover.`,
    )
  }

  await db.execute(sql`
    DO $do$
    DECLARE
      table_name text;
    BEGIN
      FOREACH table_name IN ARRAY ${sql.raw(sqlStringArray(LEGACY_BLOCK_PARENT_TABLES))} LOOP
        IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
          EXECUTE format(
            'INSERT INTO public.sitegen_legacy_block_stage (source_table, row_kind, block_order, page_id, parent_id, data) SELECT %L, ''parent'', "_order", "_parent_id"::integer, id::text, to_jsonb(source_row) FROM public.%I AS source_row',
            table_name,
            table_name
          );
        END IF;
      END LOOP;

      FOREACH table_name IN ARRAY ${sql.raw(sqlStringArray(LEGACY_BLOCK_CHILD_TABLES))} LOOP
        IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
          EXECUTE format(
            'INSERT INTO public.sitegen_legacy_block_stage (source_table, row_kind, block_order, page_id, parent_id, data) SELECT %L, ''child'', "_order", NULL, "_parent_id"::text, to_jsonb(source_row) FROM public.%I AS source_row',
            table_name,
            table_name
          );
        END IF;
      END LOOP;
    END $do$;
  `)
}

/** Clear only the old block tables after staging; pages/media/settings remain. */
export async function clearLegacyRelationalBlocks(db: Database): Promise<void> {
  await db.execute(sql`
    DO $do$
    DECLARE
      table_name text;
    BEGIN
      FOREACH table_name IN ARRAY ${sql.raw(sqlStringArray(LEGACY_BLOCK_TABLES))} LOOP
        IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
          EXECUTE format('TRUNCATE TABLE public.%I CASCADE', table_name);
        END IF;
      END LOOP;
    END $do$;
  `)
}

export async function dropLegacyBlockStage(db: Database): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS public.sitegen_legacy_block_stage;
  `)
}

/**
 * The first generated DDL removes the old generic families. Historical
 * specialized hero and optional block tables are not part of that generated
 * diff, so remove them explicitly once their rows have been staged and the
 * canonical hero table has been created.
 */
export async function dropLegacyRelationalBlockTables(db: Database): Promise<void> {
  await db.execute(sql`
    DO $do$
    DECLARE
      table_name text;
    BEGIN
      FOREACH table_name IN ARRAY ${sql.raw(sqlStringArray(LEGACY_TABLES_REMAINING_AFTER_FIRST_DDL))} LOOP
        IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
          EXECUTE format('DROP TABLE public.%I CASCADE', table_name);
        END IF;
      END LOOP;
    END $do$;
  `)
}

/**
 * The legal page is settings-owned in the first-party model. It stays in the
 * relational page table until the final restoration step so staged rows can
 * be skipped by slug without making the restoration lose its page context.
 */
export async function removeLegacyPrivacyPages(db: Database): Promise<void> {
  await db.execute(sql`
    DELETE FROM public.pages
    WHERE slug = 'privacy-en-cookieverklaring'
      AND id IN (
        SELECT DISTINCT page_id
        FROM public.sitegen_legacy_block_stage
        WHERE page_id IS NOT NULL
      );
  `)
}

type LegacyStageRow = {
  stage_id: string | number
  source_table: string
  row_kind: "parent" | "child"
  block_order: number | string
  page_id: number | string | null
  parent_id: string
  data: unknown
}

type LegacyPage = {
  id: number | string
  slug: string
  tenant_id: number | string
}

const record = (value: unknown): JsonRecord => {
  const parsed = jsonValue(value)
  return isRecord(parsed) ? parsed : {}
}

const clean = (value: unknown): string | null => {
  if (typeof value !== "string" && typeof value !== "number") return null
  const output = String(value).trim()
  return output ? output : null
}

const inlineText = (value: unknown): string | null => {
  if (typeof value !== "string" && typeof value !== "number") return null
  const output = String(value)
  return output.trim() ? output : null
}

/** Convert old Payload rich text or plain values to the new semantic string fields. */
export const legacyPlainText = (value: unknown): string | null => {
  const parsed = jsonValue(value)
  const direct = clean(parsed)
  if (direct) return direct
  if (Array.isArray(parsed)) {
    const parts = parsed.map(legacyPlainText).filter((part): part is string => Boolean(part))
    return parts.length ? parts.join("\n\n") : null
  }
  if (!isRecord(parsed)) return null
  const inline = inlineText(parsed.v)
  if (inline) return inline
  const valueText = clean(parsed.value)
  if (valueText) return valueText
  const children = Array.isArray(parsed.children) ? parsed.children : null
  if (children) {
    const parts = children.map(legacyPlainText).filter((part): part is string => Boolean(part))
    return parts.length ? parts.join("") : null
  }
  const items = Array.isArray(parsed.items) ? parsed.items : null
  if (items) {
    const parts = items.map(legacyPlainText).filter((part): part is string => Boolean(part))
    return parts.length ? parts.join("\n\n") : null
  }
  return null
}

const isRtRoot = (value: unknown): boolean => {
  const parsed = jsonValue(value)
  return isRecord(parsed)
    && parsed.t === "root"
    && (parsed.variant === "block" || parsed.variant === "inline")
    && Array.isArray(parsed.children)
}

const hasValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return false
  if (typeof value === "string" || typeof value === "number") return clean(value) !== null
  return true
}

const first = (...values: unknown[]): unknown => values.find(hasValue)

const stringField = (data: JsonRecord, ...keys: string[]): string | null =>
  legacyPlainText(first(...keys.map((key) => data[key])))

const hrefField = (data: JsonRecord, ...keys: string[]): string | null => {
  for (const key of keys) {
    const value = jsonValue(data[key])
    const direct = clean(value)
    if (direct) return direct
    if (isRecord(value)) {
      const nested = clean(value.href)
      if (nested) return nested
    }
  }
  return null
}

type ActionValues = { label: string | null; href: string | null }

const actionValues = (data: JsonRecord, prefix: string, objectKey = prefix): ActionValues => {
  const nested = record(data[objectKey])
  return {
    label: stringField(data, `${prefix}_label`, `${prefix}Label`, `${objectKey}.label`) ?? clean(nested.label),
    href: hrefField(data, `${prefix}_href`, `${prefix}Href`, `${objectKey}.href`) ?? clean(nested.href),
  }
}

const mediaId = (data: JsonRecord, ...keys: string[]): number | null => {
  for (const key of keys) {
    const value = jsonValue(data[key])
    if (typeof value === "number" && Number.isInteger(value) && value > 0) return value
    if (typeof value === "string" && /^\d+$/.test(value) && Number(value) > 0) return Number(value)
    if (isRecord(value)) {
      const nested = value.id
      if (typeof nested === "number" && Number.isInteger(nested) && nested > 0) return nested
      if (typeof nested === "string" && /^\d+$/.test(nested) && Number(nested) > 0) return Number(nested)
    }
  }
  return null
}

const sourceId = (sourceTable: string, value: unknown): string => {
  const source = sourceTable.replace(/^pages_blocks_/, "").replaceAll("_", "-")
  return `legacy-${source}-${clean(value) ?? "row"}`
}

const asOrder = (value: number | string): number => Number(value) || 0
const asPageId = (value: number | string | null): number => Number(value)

const safeBlockName = (data: JsonRecord): string | null => clean(data.block_name)
const safeAnchor = (data: JsonRecord): string | null => clean(data.anchor)

const heroVariantFrom = (sourceTable: string, data: JsonRecord, image: number | null, serviceCount: number): string => {
  const specialized: Record<string, string> = {
    pages_blocks_hero_minimal: "hero-01",
    pages_blocks_hero_split: "hero-03",
    pages_blocks_hero_portrait: "hero-04",
    pages_blocks_hero_band: "hero-05",
    pages_blocks_hero_card: "hero-04",
    pages_blocks_hero_editorial: "hero-05",
    pages_blocks_hero_framed: "hero-04",
    pages_blocks_hero_angled: "hero-03",
    pages_blocks_hero_edge: "hero-03",
    pages_blocks_hero_cover_panel: "hero-05",
    pages_blocks_hero_image_below: "hero-05",
    pages_blocks_hero_image_first: "hero-05",
    pages_blocks_hero_rail: "hero-04",
    pages_blocks_hero_color_field: "hero-04",
    pages_blocks_hero_color_image: "hero-04",
    pages_blocks_hero_photo_stage: "hero-05",
    pages_blocks_hero_pattern_split: "hero-05",
    pages_blocks_hero_pattern_band: "hero-05",
    pages_blocks_hero_showcase: "hero-05",
    pages_blocks_hero_cover_actions: "hero-01",
    pages_blocks_hero_service_mosaic: "hero-02",
    pages_blocks_hero_service_panel: "hero-02",
  }
  const raw = clean(data.design_variant) ?? clean(data.variant)
  const normalized = raw?.replace(/^shadcnui-blocks\./, "") ?? null
  const oldToNew: Record<string, string> = {
    heroMinimal: "hero-01",
    heroSplit: "hero-03",
    heroPortrait: "hero-04",
    heroBand: "hero-05",
    heroCard: "hero-04",
    heroEditorial: "hero-05",
    heroFramed: "hero-04",
    heroAngled: "hero-03",
    heroEdge: "hero-03",
    heroCoverPanel: "hero-05",
    heroImageBelow: "hero-05",
    heroImageFirst: "hero-05",
    heroRail: "hero-04",
    heroColorField: "hero-04",
    heroColorImage: "hero-04",
    heroPhotoStage: "hero-05",
    heroPatternSplit: "hero-05",
    heroPatternBand: "hero-05",
    heroShowcase: "hero-05",
    heroCoverActions: "hero-01",
    heroServiceMosaic: "hero-02",
    heroServicePanel: "hero-02",
  }
  let variant = specialized[sourceTable] ?? oldToNew[normalized ?? ""] ?? (normalized?.startsWith("hero-") ? normalized : "hero-01")
  if (!["hero-01", "hero-02", "hero-03", "hero-04", "hero-05"].includes(variant)) variant = "hero-01"
  if (variant === "hero-02" && (!image || serviceCount < 2)) variant = image ? "hero-03" : "hero-01"
  if (variant !== "hero-01" && !image) variant = "hero-01"
  return variant
}

const iconName = (value: unknown): string | null => {
  const normalized = clean(value)?.toLowerCase() ?? ""
  const aliases: Record<string, string> = {
    ear: "message",
    "heart-handshake": "heart",
    "building-2": "building",
    "map-pin": "map-pin",
  }
  const allowed = new Set([
    "briefcase", "building", "calendar", "camera", "check-circle", "clipboard", "clock", "globe", "heart", "house",
    "layers", "map-pin", "message", "package", "ruler", "shield-check", "spark", "star", "user", "wrench",
  ])
  const output = aliases[normalized] ?? normalized
  return allowed.has(output) ? output : null
}

const parentChildren = (children: LegacyStageRow[], source: string, parentId: string): LegacyStageRow[] =>
  children
    .filter((child) => childParentSource[child.source_table] === source && child.parent_id === parentId)
    .sort((a, b) => asOrder(a.block_order) - asOrder(b.block_order) || Number(a.stage_id) - Number(b.stage_id))

const allChildrenForSource = (children: LegacyStageRow[], sources: string[], parentId: string): LegacyStageRow[] =>
  children
    .filter((child) => sources.includes(childParentSource[child.source_table] ?? "") && child.parent_id === parentId)
    .sort((a, b) => asOrder(a.block_order) - asOrder(b.block_order) || Number(a.stage_id) - Number(b.stage_id))

const textWithFallback = (value: unknown, fallback: string): string => legacyPlainText(value) ?? fallback

const joinText = (...values: unknown[]): string | null => {
  const parts = values.map(legacyPlainText).filter((part): part is string => Boolean(part))
  return parts.length ? parts.join("\n\n") : null
}

const childMediaIds = (data: JsonRecord): number[] => {
  const keys = ["image_id", "before_image_id", "after_image_id", "before_id", "after_id", "media_id"]
  return keys
    .map((key) => mediaId(data, key))
    .filter((value): value is number => value !== null)
}

const insertAbout = async (
  db: Database,
  parent: LegacyStageRow,
  pageId: number,
  heading: string,
  body: string,
  portrait: number | null,
  highlights: Array<{ title: string; text: string | null }>,
): Promise<void> => {
  const data = record(parent.data)
  const id = sourceId(parent.source_table, data.id ?? parent.parent_id)
  await db.execute(sql`
    INSERT INTO public.pages_blocks_about
      ("_order", "_parent_id", "_path", id, heading, body, portrait_id, anchor, block_name)
    VALUES (${asOrder(parent.block_order)}, ${pageId}, ${clean(data._path) ?? "blocks"}, ${id}, ${heading}, ${body}, ${portrait}, ${safeAnchor(data)}, ${safeBlockName(data)})
  `)
  for (const [index, highlight] of highlights.slice(0, 4).entries()) {
    await db.execute(sql`
      INSERT INTO public.pages_blocks_about_highlights
        ("_order", "_parent_id", id, title, text)
      VALUES (${index}, ${id}, ${sourceId("about-highlight", `${id}-${index}`)}, ${highlight.title}, ${highlight.text})
    `)
  }
}

const mapAboutHighlights = (children: LegacyStageRow[], parentSource: string, parentId: string) => {
  const relevant = allChildrenForSource(children, [parentSource], parentId)
  return relevant.map((child) => {
    const data = record(child.data)
    const title = textWithFallback(first(data.title, data.name, data.label, data.value), "Meer informatie")
    const text = joinText(data.text, data.description, data.bio, data.role, data.value === title ? null : data.value)
    return { title, text }
  })
}

/**
 * Restore staged rows after all canonical tables and final enums exist. Each
 * target insert is explicit; unsupported decorative/provider fields are not
 * copied, while their meaningful content is folded into a semantic block.
 */
export async function restoreLegacyRelationalBlocks(db: Database): Promise<void> {
  const stageResult = await db.execute(sql`
    SELECT stage_id, source_table, row_kind, block_order, page_id, parent_id, data
    FROM public.sitegen_legacy_block_stage
    ORDER BY stage_id;
  `)
  const stageRows = rowsFrom<LegacyStageRow>(stageResult)
  if (!stageRows.length) return

  const pageResult = await db.execute(sql`
    SELECT id, slug, tenant_id
    FROM public.pages;
  `)
  const pages = new Map(rowsFrom<LegacyPage>(pageResult).map((page) => [String(page.id), page]))
  const parents = stageRows.filter((row) => row.row_kind === "parent")
  const children = stageRows.filter((row) => row.row_kind === "child")

  const targetTables = [
    "pages_blocks_hero", "pages_blocks_services", "pages_blocks_about", "pages_blocks_process", "pages_blocks_work",
    "pages_blocks_reviews", "pages_blocks_pricing", "pages_blocks_faq", "pages_blocks_cta", "pages_blocks_contact",
  ]
  await db.execute(sql`
    DO $do$
    DECLARE
      table_name text;
      row_count bigint;
    BEGIN
      FOREACH table_name IN ARRAY ${sql.raw(sqlStringArray(targetTables))} LOOP
        IF to_regclass(format('public.%I', table_name)) IS NULL THEN
          RAISE EXCEPTION 'Canonical block table public.% does not exist; legacy block restoration cannot run safely.', table_name;
        END IF;
        EXECUTE format('SELECT count(*) FROM public.%I', table_name) INTO row_count;
        IF row_count > 0 THEN
          RAISE EXCEPTION 'Canonical block table public.% already contains % row(s); legacy block restoration cannot run safely.', table_name, row_count;
        END IF;
      END LOOP;
    END $do$;
  `)

  const restoredHeroIds = new Set<string>()
  for (const parent of parents) {
    const pageId = asPageId(parent.page_id)
    const page = pages.get(String(pageId))
    if (!page) throw new Error(`Legacy block ${parent.source_table}/${parent.parent_id} references missing page ${pageId}.`)
    if (page.slug === "privacy-en-cookieverklaring") continue

    const data = record(parent.data)
    const originalId = data.id ?? parent.parent_id
    const childRows = parentChildren(children, parent.source_table, parent.parent_id)
    const image = mediaId(data, "image_id", "background_image_id")
    const heading = textWithFallback(first(data.heading, data.title, data.headline), "Meer informatie")
    const body = textWithFallback(first(data.body, data.description, data.intro, data.subheadline), "Neem contact op voor meer informatie.")
    const blockId = sourceId(parent.source_table, originalId)

    if (parent.source_table === "pages_blocks_hero" || parent.source_table.startsWith("pages_blocks_hero_")) {
      const duplicateKey = `${pageId}:${String(originalId)}`
      if (restoredHeroIds.has(duplicateKey)) continue
      restoredHeroIds.add(duplicateKey)
      const serviceRows = childRows.filter((child) => child.source_table.endsWith("service_highlights"))
      const valueHighlightRows = childRows.filter((child) => child.source_table === "pages_blocks_hero_highlights")
      const variant = heroVariantFrom(parent.source_table, data, image, serviceRows.length)
      const heroBodyParts = [body]
      const serviceHighlights = serviceRows.slice(0, 4).map((child) => {
        const childData = record(child.data)
        const primary = actionValues(childData, "primary_action", "primaryAction")
        const secondary = actionValues(childData, "secondary_action", "secondaryAction")
        return {
          order: asOrder(child.block_order),
          id: sourceId(child.source_table, childData.id ?? child.parent_id),
          title: textWithFallback(first(childData.title, childData.name), "Dienst"),
          body: textWithFallback(first(childData.body, childData.description), "Neem contact op voor meer informatie."),
          heroHeading: stringField(childData, "hero_heading", "heroHeading"),
          heroBody: stringField(childData, "hero_body", "heroBody"),
          primaryLabel: primary.label,
          primaryHref: primary.href,
          secondaryLabel: secondary.label,
          secondaryHref: secondary.href,
          image: mediaId(childData, "image_id"),
        }
      })
      if (variant !== "hero-02") {
        heroBodyParts.push(...serviceRows.map((child) => {
          const childData = record(child.data)
          return joinText(childData.title, childData.body, childData.description)
        }).filter((part): part is string => Boolean(part)))
        // Hero 01 supports a two-to-four item value-point collection. Preserve
        // a legacy single item (or value points attached to a retired hero
        // shape) in the body rather than creating an invalid one-item array.
        if (variant !== "hero-01" || valueHighlightRows.length === 1) {
          heroBodyParts.push(...valueHighlightRows.map((child) => {
            const childData = record(child.data)
            return joinText(childData.title, childData.body, childData.description)
          }).filter((part): part is string => Boolean(part)))
        }
      }
      await db.execute(sql`
        INSERT INTO public.pages_blocks_hero
          ("_order", "_parent_id", "_path", id, variant, heading, body, primary_action_label, primary_action_href, secondary_action_label, secondary_action_href, image_id, anchor, block_name)
        VALUES (${asOrder(parent.block_order)}, ${pageId}, ${clean(data._path) ?? "blocks"}, ${blockId}, ${variant}, ${heading}, ${heroBodyParts.filter(Boolean).join("\n\n")}, ${textWithFallback(first(data.primary_action_label, data.cta_label, record(data.cta).label), "Neem contact op")}, ${hrefField(data, "primary_action_href", "cta_href") ?? clean(record(data.cta).href) ?? "#contact"}, ${stringField(data, "secondary_action_label", "secondary_label")}, ${hrefField(data, "secondary_action_href", "secondary_href")}, ${image}, ${safeAnchor(data)}, ${safeBlockName(data)})
      `)
      if (variant === "hero-02") {
        for (const highlight of serviceHighlights) {
          await db.execute(sql`
            INSERT INTO public.pages_blocks_hero_service_highlights
              ("_order", "_parent_id", id, title, body, hero_heading, hero_body, primary_action_label, primary_action_href, secondary_action_label, secondary_action_href, image_id)
            VALUES (${highlight.order}, ${blockId}, ${highlight.id}, ${highlight.title}, ${highlight.body}, ${highlight.heroHeading}, ${highlight.heroBody}, ${highlight.primaryLabel}, ${highlight.primaryHref}, ${highlight.secondaryLabel}, ${highlight.secondaryHref}, ${highlight.image})
          `)
        }
      }
      if (variant === "hero-01" && valueHighlightRows.length >= 2) {
        for (const [index, child] of valueHighlightRows.slice(0, 4).entries()) {
          const childData = record(child.data)
          await db.execute(sql`
            INSERT INTO public.pages_blocks_hero_highlights
              ("_order", "_parent_id", id, title, body)
            VALUES (${index}, ${blockId}, ${sourceId("hero-highlight", childData.id ?? `${blockId}-${index}`)}, ${textWithFallback(first(childData.title, childData.name), "Sterk punt")}, ${textWithFallback(first(childData.body, childData.description), "Neem contact op voor meer informatie.")})
          `)
        }
      }
      continue
    }

    const serviceSources = [
      "pages_blocks_feature_list", "pages_blocks_info_card_list", "pages_blocks_service_carousel", "pages_blocks_bento_grid",
    ]
    if (serviceSources.includes(parent.source_table)) {
      const itemRows = childRows.filter((child) => child.source_table.endsWith("_features") || child.source_table.endsWith("_items"))
      const items = itemRows.map((child) => {
        const childData = record(child.data)
        const action = actionValues(childData, "cta", "cta")
        return {
          title: textWithFallback(first(childData.title, childData.name), "Dienst"),
          body: textWithFallback(first(childData.body, childData.description), "Neem contact op voor meer informatie."),
          icon: iconName(childData.icon),
          actionLabel: action.label,
          actionHref: action.href,
        }
      })
      if (items.length >= 2) {
        await db.execute(sql`
          INSERT INTO public.pages_blocks_services
            ("_order", "_parent_id", "_path", id, variant, heading, intro, anchor, block_name)
          VALUES (${asOrder(parent.block_order)}, ${pageId}, ${clean(data._path) ?? "blocks"}, ${blockId}, 'services-01', ${heading}, ${stringField(data, "intro")}, ${safeAnchor(data)}, ${safeBlockName(data)})
        `)
        for (const [index, item] of items.slice(0, 6).entries()) {
          await db.execute(sql`
            INSERT INTO public.pages_blocks_services_items
              ("_order", "_parent_id", id, title, body, icon, action_label, action_href)
            VALUES (${index}, ${blockId}, ${sourceId("services-item", `${blockId}-${index}`)}, ${item.title}, ${item.body}, ${item.icon}, ${item.actionLabel}, ${item.actionHref})
          `)
        }
      } else {
        await insertAbout(db, parent, pageId, heading, joinText(body, ...items.map((item) => `${item.title}: ${item.body}`)) ?? body, image, items.map((item) => ({ title: item.title, text: item.body })))
      }
      continue
    }

    if (parent.source_table === "pages_blocks_testimonials") {
      const itemRows = childRows.filter((child) => child.source_table === "pages_blocks_testimonials_items")
      if (itemRows.length === 0) {
        await insertAbout(db, parent, pageId, heading, body, image, [])
        continue
      }
      await db.execute(sql`
        INSERT INTO public.pages_blocks_reviews
          ("_order", "_parent_id", "_path", id, heading, intro, anchor, block_name)
        VALUES (${asOrder(parent.block_order)}, ${pageId}, ${clean(data._path) ?? "blocks"}, ${blockId}, ${heading}, ${stringField(data, "intro")}, ${safeAnchor(data)}, ${safeBlockName(data)})
      `)
      for (const [index, child] of itemRows.slice(0, 6).entries()) {
        const childData = record(child.data)
        const id = sourceId("review", childData.id ?? `${blockId}-${index}`)
        const quote = textWithFallback(first(childData.quote, childData.body, childData.description), "")
        const name = textWithFallback(first(childData.name, childData.author), "Klant")
        await db.execute(sql`
          INSERT INTO public.pages_blocks_reviews_review_source_ids ("_order", "_parent_id", id, source_id)
          VALUES (${index}, ${blockId}, ${sourceId("review-ref", `${blockId}-${index}`)}, ${id})
        `)
        await db.execute(sql`
          INSERT INTO public.pages_blocks_reviews_items ("_order", "_parent_id", id, source_id, quote, name, context)
          VALUES (${index}, ${blockId}, ${sourceId("review-item", `${blockId}-${index}`)}, ${id}, ${quote}, ${name}, ${stringField(childData, "role", "context")})
        `)
      }
      continue
    }

    if (parent.source_table === "pages_blocks_pricing") {
      const planRows = childRows.filter((child) => child.source_table === "pages_blocks_pricing_plans")
      if (planRows.length === 0) {
        await insertAbout(db, parent, pageId, heading, body, image, [])
        continue
      }
      await db.execute(sql`
        INSERT INTO public.pages_blocks_pricing
          ("_order", "_parent_id", "_path", id, heading, intro, anchor, block_name)
        VALUES (${asOrder(parent.block_order)}, ${pageId}, ${clean(data._path) ?? "blocks"}, ${blockId}, ${heading}, ${stringField(data, "intro")}, ${safeAnchor(data)}, ${safeBlockName(data)})
      `)
      for (const [index, child] of planRows.slice(0, 4).entries()) {
        const childData = record(child.data)
        const offerId = sourceId("pricing", childData.id ?? `${blockId}-${index}`)
        const featureRows = parentChildren(children, child.source_table, child.parent_id).filter((feature) => feature.source_table === "pages_blocks_pricing_plans_features")
        await db.execute(sql`
          INSERT INTO public.pages_blocks_pricing_pricing_source_ids ("_order", "_parent_id", id, source_id)
          VALUES (${index}, ${blockId}, ${sourceId("pricing-ref", `${blockId}-${index}`)}, ${offerId})
        `)
        await db.execute(sql`
          INSERT INTO public.pages_blocks_pricing_offers
            ("_order", "_parent_id", id, source_id, title, description, price, period, action_label, action_href, badge)
          VALUES (${index}, ${blockId}, ${sourceId("pricing-offer", `${blockId}-${index}`)}, ${offerId}, ${textWithFallback(first(childData.title, childData.name), "Aanbod")}, ${stringField(childData, "description")}, ${textWithFallback(first(childData.price, childData.amount), "Op aanvraag")}, ${stringField(childData, "period")}, ${stringField(childData, "cta_label", "action_label")}, ${hrefField(childData, "cta_href", "action_href")}, ${stringField(childData, "badge")})
        `)
        for (const [featureIndex, feature] of featureRows.slice(0, 12).entries()) {
          const featureData = record(feature.data)
          await db.execute(sql`
            INSERT INTO public.pages_blocks_pricing_offers_features ("_order", "_parent_id", id, value)
            VALUES (${featureIndex}, ${sourceId("pricing-offer", `${blockId}-${index}`)}, ${sourceId("pricing-feature", `${blockId}-${index}-${featureIndex}`)}, ${textWithFallback(first(featureData.label, featureData.value), "Inbegrepen")})
          `)
        }
      }
      continue
    }

    if (parent.source_table === "pages_blocks_faq") {
      const itemRows = childRows.filter((child) => child.source_table === "pages_blocks_faq_items")
      if (itemRows.length < 2) {
        await insertAbout(db, parent, pageId, heading, body, image, itemRows.map((child) => {
          const childData = record(child.data)
          return { title: textWithFallback(childData.question, "Vraag"), text: stringField(childData, "answer") }
        }))
        continue
      }
      await db.execute(sql`
        INSERT INTO public.pages_blocks_faq
          ("_order", "_parent_id", "_path", id, heading, intro, anchor, block_name)
        VALUES (${asOrder(parent.block_order)}, ${pageId}, ${clean(data._path) ?? "blocks"}, ${blockId}, ${heading}, ${stringField(data, "intro")}, ${safeAnchor(data)}, ${safeBlockName(data)})
      `)
      for (const [index, child] of itemRows.slice(0, 10).entries()) {
        const childData = record(child.data)
        await db.execute(sql`
          INSERT INTO public.pages_blocks_faq_items ("_order", "_parent_id", id, question, answer)
          VALUES (${index}, ${blockId}, ${sourceId("faq-item", `${blockId}-${index}`)}, ${textWithFallback(childData.question, "Vraag")}, ${textWithFallback(childData.answer, "Neem contact op voor meer informatie.")})
        `)
      }
      continue
    }

    if (parent.source_table === "pages_blocks_cta" || parent.source_table === "pages_blocks_newsletter") {
      const primary = actionValues(data, "primary_action", "primary")
      const oldVariant = clean(data.design_variant)?.replace(/^shadcnui-blocks\./, "")
      const variant = oldVariant === "cta-02" ? "cta-02" : "cta-01"
      const actionLabel = primary.label ?? stringField(data, "cta_label") ?? "Neem contact op"
      const actionHref = primary.href ?? hrefField(data, "cta_href") ?? "#contact"
      await db.execute(sql`
        INSERT INTO public.pages_blocks_cta
          ("_order", "_parent_id", "_path", id, variant, heading, body, primary_action_label, primary_action_href, secondary_action_label, secondary_action_href, image_id, anchor, block_name)
        VALUES (${asOrder(parent.block_order)}, ${pageId}, ${clean(data._path) ?? "blocks"}, ${blockId}, ${variant}, ${heading}, ${stringField(data, "body", "description")}, ${actionLabel}, ${actionHref}, ${stringField(data, "secondary_action_label", "secondary_label")}, ${hrefField(data, "secondary_action_href", "secondary_href")}, ${image}, ${safeAnchor(data)}, ${safeBlockName(data)})
      `)
      continue
    }

    if (parent.source_table === "pages_blocks_contact_details" || parent.source_table === "pages_blocks_contact_section") {
      const detailRows = childRows.filter((child) => child.source_table === "pages_blocks_contact_details_items")
      const formRows = childRows.filter((child) => child.source_table === "pages_blocks_contact_section_fields")
      const methods = detailRows.map((child) => {
        const childData = record(child.data)
        const href = clean(childData.href)
        const label = textWithFallback(first(childData.title, childData.label), "Contact")
        const value = textWithFallback(first(childData.value, childData.description), label)
        const icon = clean(childData.icon)
        const kind = href?.startsWith("mailto:") || icon === "mail" ? "email" : href?.startsWith("tel:") || icon === "phone" ? "phone" : icon === "map-pin" ? "address" : "other"
        return { order: asOrder(child.block_order), id: sourceId("contact-method", childData.id ?? child.parent_id), kind, label, value, href }
      })
      const formFields = formRows.map((child) => {
        const childData = record(child.data)
        const fieldId = sourceId("contact-field", childData.id ?? child.parent_id)
        const options = parentChildren(children, child.source_table, child.parent_id).filter((option) => option.source_table === "pages_blocks_contact_section_fields_options")
        return {
          order: asOrder(child.block_order), id: fieldId, name: textWithFallback(childData.name, `field-${childData.id ?? child.block_order}`), label: textWithFallback(childData.label, "Contact"), type: textWithFallback(childData.type, "text"), required: childData.required === true, placeholder: stringField(childData, "placeholder"), options,
        }
      })
      const finalMethods = methods.length ? methods : [{ order: 0, id: sourceId("contact-method", `${blockId}-email`), kind: "email", label: "E-mail", value: "Neem contact op", href: null }]
      await db.execute(sql`
        INSERT INTO public.pages_blocks_contact
          ("_order", "_parent_id", "_path", id, heading, body, opening_hours, booking_action_label, booking_action_href, form_form_name, form_submit_label, image_id, anchor, block_name)
        VALUES (${asOrder(parent.block_order)}, ${pageId}, ${clean(data._path) ?? "blocks"}, ${blockId}, ${heading}, ${stringField(data, "body", "description")}, ${stringField(data, "opening_hours")}, ${stringField(data, "booking_action_label")}, ${hrefField(data, "booking_action_href")}, 'contact', 'Verstuur bericht', ${image}, ${safeAnchor(data)}, ${safeBlockName(data)})
      `)
      for (const method of finalMethods.slice(0, 4)) {
        await db.execute(sql`
          INSERT INTO public.pages_blocks_contact_contact_methods ("_order", "_parent_id", id, kind, label, value, href)
          VALUES (${method.order}, ${blockId}, ${method.id}, ${method.kind}, ${method.label}, ${method.value}, ${method.href})
        `)
      }
      const finalFields = formFields.length ? formFields : [{ order: 0, id: sourceId("contact-field", `${blockId}-message`), name: "message", label: "Bericht", type: "textarea", required: true, placeholder: null, options: [] }]
      for (const field of finalFields.slice(0, 12)) {
        const type = ["text", "email", "tel", "textarea", "select", "checkbox"].includes(field.type) ? field.type : "text"
        await db.execute(sql`
          INSERT INTO public.pages_blocks_contact_form_fields ("_order", "_parent_id", id, name, label, type, required, placeholder)
          VALUES (${field.order}, ${blockId}, ${field.id}, ${field.name}, ${field.label}, ${type}, ${field.required}, ${field.placeholder})
        `)
        for (const [optionIndex, option] of field.options.slice(0, 12).entries()) {
          const optionData = record(option.data)
          await db.execute(sql`
            INSERT INTO public.pages_blocks_contact_form_fields_options ("_order", "_parent_id", id, label, value)
            VALUES (${optionIndex}, ${field.id}, ${sourceId("contact-option", `${field.id}-${optionIndex}`)}, ${textWithFallback(optionData.label, "Optie")}, ${textWithFallback(optionData.value, "option")})
          `)
        }
      }
      continue
    }

    if (parent.source_table === "pages_blocks_timeline") {
      const stepRows = childRows.filter((child) => child.source_table === "pages_blocks_timeline_items")
      if (stepRows.length < 2) {
        await insertAbout(db, parent, pageId, heading, body, image, stepRows.map((child) => {
          const childData = record(child.data)
          return { title: textWithFallback(childData.title, "Stap"), text: stringField(childData, "description") }
        }))
        continue
      }
      await db.execute(sql`
        INSERT INTO public.pages_blocks_process ("_order", "_parent_id", "_path", id, heading, intro, anchor, block_name)
        VALUES (${asOrder(parent.block_order)}, ${pageId}, ${clean(data._path) ?? "blocks"}, ${blockId}, ${heading}, ${stringField(data, "intro")}, ${safeAnchor(data)}, ${safeBlockName(data)})
      `)
      for (const [index, child] of stepRows.slice(0, 6).entries()) {
        const childData = record(child.data)
        await db.execute(sql`
          INSERT INTO public.pages_blocks_process_steps ("_order", "_parent_id", id, title, body)
          VALUES (${index}, ${blockId}, ${sourceId("process-step", `${blockId}-${index}`)}, ${textWithFallback(childData.title, "Stap")}, ${textWithFallback(first(childData.description, childData.body), "Neem contact op voor meer informatie.")})
        `)
      }
      continue
    }

    if (["pages_blocks_gallery", "pages_blocks_blog_cards", "pages_blocks_before_after_gallery"].includes(parent.source_table)) {
      const projectRows = childRows.filter((child) => ["pages_blocks_gallery_images", "pages_blocks_blog_cards_posts", "pages_blocks_before_after_gallery_pairs"].includes(child.source_table))
      const projects = projectRows.length ? projectRows : [parent]
      await db.execute(sql`
        INSERT INTO public.pages_blocks_work ("_order", "_parent_id", "_path", id, heading, intro, anchor, block_name)
        VALUES (${asOrder(parent.block_order)}, ${pageId}, ${clean(data._path) ?? "blocks"}, ${blockId}, ${heading}, ${stringField(data, "intro")}, ${safeAnchor(data)}, ${safeBlockName(data)})
      `)
      for (const [index, project] of projects.slice(0, 6).entries()) {
        const projectData = record(project.data)
        const media = childMediaIds(projectData)
        if (project === parent) media.push(...childMediaIds(data))
        const projectId = sourceId("project", projectData.id ?? `${blockId}-${index}`)
        await db.execute(sql`
          INSERT INTO public.pages_blocks_work_projects ("_order", "_parent_id", id, source_id, title, summary, action_label, action_href)
          VALUES (${index}, ${blockId}, ${projectId}, ${projectId}, ${textWithFallback(first(projectData.title, projectData.name, projectData.caption), `Project ${index + 1}`)}, ${stringField(projectData, "summary", "excerpt", "description")}, ${stringField(projectData, "cta_label", "action_label")}, ${hrefField(projectData, "cta_href", "action_href")})
        `)
        for (const [mediaIndex, imageId] of [...new Set(media)].slice(0, 8).entries()) {
          await db.execute(sql`
            INSERT INTO public.pages_blocks_work_projects_media ("_order", "_parent_id", id, image_id)
            VALUES (${mediaIndex}, ${projectId}, ${sourceId("project-media", `${projectId}-${mediaIndex}`)}, ${imageId})
          `)
        }
      }
      continue
    }

    if (["pages_blocks_team", "pages_blocks_stats", "pages_blocks_logo_cloud", "pages_blocks_content_section", "pages_blocks_rich_text"].includes(parent.source_table)) {
      const highlights = mapAboutHighlights(children, parent.source_table, parent.parent_id)
      const teamPortrait = parent.source_table === "pages_blocks_team"
        ? mediaId(record(parentChildren(children, parent.source_table, parent.parent_id)[0]?.data), "avatar_id", "image_id")
        : null
      const extra = parent.source_table === "pages_blocks_content_section"
        ? joinText(data.secondary_title, data.secondary_body)
        : null
      const finalBody = joinText(data.body, data.intro, extra, ...highlights.slice(4).map((item) => `${item.title}${item.text ? `: ${item.text}` : ""}`)) ?? body
      await insertAbout(db, parent, pageId, heading, finalBody, image ?? teamPortrait, highlights)
      continue
    }

    // A future legacy table should not disappear silently. Preserve its row as
    // a compact owned about section until a more specific semantic mapping is
    // intentionally added.
    await insertAbout(db, parent, pageId, heading, body, image, [])
  }
}

const legacyBlockType = (value: unknown): string | null => {
  const raw = clean(value)?.replace(/^shadcnui-blocks\./, "")
  if (!raw) return null
  if (raw === "hero" || raw.startsWith("hero")) return "hero"
  const map: Record<string, string> = {
    featureList: "services",
    infoCardList: "services",
    serviceCarousel: "services",
    bentoGrid: "services",
    testimonials: "reviews",
    contactSection: "contact",
    contactDetails: "contact",
    gallery: "work",
    beforeAfterGallery: "work",
    blogCards: "work",
    timeline: "process",
    team: "about",
    stats: "about",
    logoCloud: "about",
    contentSection: "about",
    richText: "about",
    newsletter: "cta",
  }
  return map[raw] ?? (["services", "about", "process", "work", "reviews", "pricing", "faq", "cta", "contact"].includes(raw) ? raw : null)
}

const normalizedMedia = (value: unknown): unknown => {
  const parsed = jsonValue(value)
  if (!isRecord(parsed)) return parsed
  const out: JsonRecord = {}
  for (const key of ["id", "url", "filename", "alt", "width", "height"]) {
    if (parsed[key] !== undefined) out[key] = parsed[key]
  }
  return Object.keys(out).length ? out : null
}

const normalizedAction = (value: unknown): JsonRecord | null => {
  const parsed = jsonValue(value)
  if (!isRecord(parsed)) return null
  const label = clean(parsed.label)
  const href = clean(parsed.href)
  return label && href ? { label, href, ...(parsed.external === true ? { external: true } : {}) } : null
}

const canonicalBlock = (value: JsonRecord): JsonRecord | null => {
  const kind = legacyBlockType(value.blockType)
  if (!kind) return null
  const anchor = clean(value.anchor)
  const base: JsonRecord = {
    ...(clean(value.id) ? { id: clean(value.id) } : {}),
    ...(anchor ? { anchor } : {}),
    ...(isRecord(value.analytics) ? { analytics: value.analytics } : {}),
  }

  if (kind === "hero") {
    const image = normalizedMedia(value.image ?? value.backgroundImage)
    const serviceHighlights = Array.isArray(value.serviceHighlights) ? value.serviceHighlights : []
    const rawVariant = clean(value.variant) ?? clean(value.designVariant)
    const variant = heroVariantFrom("pages_blocks_hero", { design_variant: rawVariant }, image ? 1 : null, serviceHighlights.length)
    const output: JsonRecord = {
      ...base,
      blockType: "hero",
      variant,
      heading: textWithFallback(first(value.heading, value.headline), "Welkom"),
      body: textWithFallback(first(value.body, value.subheadline), "Neem contact op voor meer informatie."),
      primaryAction: normalizedAction(value.primaryAction ?? value.cta) ?? { label: "Neem contact op", href: "#contact" },
      ...(normalizedAction(value.secondaryAction ?? value.secondary) ? { secondaryAction: normalizedAction(value.secondaryAction ?? value.secondary) } : {}),
      ...(image ? { image } : {}),
    }
    if (variant === "hero-01" && Array.isArray(value.highlights) && value.highlights.length !== 1) {
      output.highlights = value.highlights.slice(0, 4).map((entry) => {
        const item = record(entry)
        return { title: textWithFallback(item.title, "Sterk punt"), body: textWithFallback(item.body ?? item.description, "") }
      })
    }
    if (variant === "hero-02" && serviceHighlights.length >= 2) {
      output.serviceHighlights = serviceHighlights.slice(0, 4).map((entry) => {
        const item = record(entry)
        return {
          title: textWithFallback(item.title, "Dienst"),
          body: textWithFallback(item.body ?? item.description, "Neem contact op voor meer informatie."),
          ...(clean(item.heroHeading) ? { heroHeading: clean(item.heroHeading) } : {}),
          ...(clean(item.heroBody) ? { heroBody: clean(item.heroBody) } : {}),
          ...(normalizedAction(item.primaryAction) ? { primaryAction: normalizedAction(item.primaryAction) } : {}),
          ...(normalizedAction(item.secondaryAction) ? { secondaryAction: normalizedAction(item.secondaryAction) } : {}),
          ...(normalizedMedia(item.image) ? { image: normalizedMedia(item.image) } : {}),
        }
      })
    }
    return output
  }

  if (kind === "services") {
    const sourceItems = Array.isArray(value.items) ? value.items : Array.isArray(value.features) ? value.features : []
    const items = sourceItems.map((entry) => {
      const item = record(entry)
      return {
        title: textWithFallback(item.title, "Dienst"),
        body: textWithFallback(item.body ?? item.description, "Neem contact op voor meer informatie."),
        ...(iconName(item.icon) ? { icon: iconName(item.icon) } : {}),
        ...(normalizedAction(item.action ?? item.cta) ? { action: normalizedAction(item.action ?? item.cta) } : {}),
      }
    }).slice(0, 6)
    if (items.length < 2) return null
    return { ...base, blockType: "services", variant: clean(value.variant) === "services-02" ? "services-02" : "services-01", heading: textWithFallback(first(value.heading, value.title), "Diensten"), ...(clean(value.intro) ? { intro: legacyPlainText(value.intro) } : {}), items }
  }

  if (kind === "about") {
    const sourceItems = Array.isArray(value.highlights) ? value.highlights : Array.isArray(value.members) ? value.members : []
    return {
      ...base,
      blockType: "about",
      heading: textWithFallback(first(value.heading, value.title), "Over dit bedrijf"),
      body: textWithFallback(first(value.body, value.intro), "Meer informatie over deze dienstverlening."),
      ...(normalizedMedia(value.portrait ?? value.image) ? { portrait: normalizedMedia(value.portrait ?? value.image) } : {}),
      highlights: sourceItems.slice(0, 4).map((entry) => {
        const item = record(entry)
        return { title: textWithFallback(first(item.title, item.name, item.label), "Sterk punt"), ...(clean(item.text ?? item.description ?? item.bio) ? { text: legacyPlainText(item.text ?? item.description ?? item.bio) } : {}) }
      }),
    }
  }

  if (kind === "process") {
    const steps = (Array.isArray(value.steps) ? value.steps : Array.isArray(value.items) ? value.items : []).slice(0, 6).map((entry) => {
      const item = record(entry)
      return { title: textWithFallback(item.title, "Stap"), body: textWithFallback(item.body ?? item.description, "Neem contact op voor meer informatie.") }
    })
    return steps.length >= 2 ? { ...base, blockType: "process", heading: textWithFallback(first(value.heading, value.title), "Werkwijze"), ...(clean(value.intro) ? { intro: legacyPlainText(value.intro) } : {}), steps } : null
  }

  if (kind === "work") {
    const projects = (Array.isArray(value.projects) ? value.projects : Array.isArray(value.items) ? value.items : Array.isArray(value.images) ? value.images : []).slice(0, 6).map((entry, index) => {
      const item = record(entry)
      const media = Array.isArray(item.media) ? item.media.map(normalizedMedia).filter(Boolean) : normalizedMedia(item.image) ? [normalizedMedia(item.image)] : []
      return { sourceId: clean(item.sourceId) ?? `legacy-project-${index + 1}`, title: textWithFallback(first(item.title, item.name, item.caption), `Project ${index + 1}`), ...(clean(item.summary ?? item.description ?? item.excerpt) ? { summary: legacyPlainText(item.summary ?? item.description ?? item.excerpt) } : {}), media }
    })
    return projects.length ? { ...base, blockType: "work", heading: textWithFallback(first(value.heading, value.title), "Werk"), ...(clean(value.intro) ? { intro: legacyPlainText(value.intro) } : {}), projects } : null
  }

  if (kind === "reviews") {
    const items = (Array.isArray(value.items) ? value.items : []).slice(0, 6).map((entry, index) => {
      const item = record(entry)
      return { sourceId: clean(item.sourceId) ?? `legacy-review-${index + 1}`, quote: textWithFallback(item.quote, ""), name: textWithFallback(item.name ?? item.author, "Klant"), ...(clean(item.context ?? item.role) ? { context: legacyPlainText(item.context ?? item.role) } : {}) }
    })
    return items.length ? { ...base, blockType: "reviews", heading: textWithFallback(first(value.heading, value.title), "Ervaringen"), ...(clean(value.intro) ? { intro: legacyPlainText(value.intro) } : {}), reviewSourceIds: items.map((item) => item.sourceId), items } : null
  }

  if (kind === "pricing") {
    const offers = (Array.isArray(value.offers) ? value.offers : Array.isArray(value.plans) ? value.plans : []).slice(0, 4).map((entry, index) => {
      const item = record(entry)
      const features = (Array.isArray(item.features) ? item.features : []).map((feature) => legacyPlainText(record(feature).value ?? feature)).filter((feature): feature is string => Boolean(feature)).slice(0, 12)
      return { sourceId: clean(item.sourceId) ?? `legacy-pricing-${index + 1}`, title: textWithFallback(item.title, "Aanbod"), ...(clean(item.description) ? { description: legacyPlainText(item.description) } : {}), price: textWithFallback(item.price, "Op aanvraag"), ...(clean(item.period) ? { period: legacyPlainText(item.period) } : {}), features, ...(normalizedAction(item.action ?? item.cta) ? { action: normalizedAction(item.action ?? item.cta) } : {}), ...(clean(item.badge) ? { badge: legacyPlainText(item.badge) } : {}) }
    })
    return offers.length ? { ...base, blockType: "pricing", heading: textWithFallback(first(value.heading, value.title), "Tarieven"), ...(clean(value.intro) ? { intro: legacyPlainText(value.intro) } : {}), pricingSourceIds: offers.map((offer) => offer.sourceId), offers } : null
  }

  if (kind === "faq") {
    const items = (Array.isArray(value.items) ? value.items : []).slice(0, 10).map((entry) => {
      const item = record(entry)
      return { question: textWithFallback(item.question, "Vraag"), answer: textWithFallback(item.answer, "Neem contact op voor meer informatie.") }
    })
    return items.length >= 2 ? { ...base, blockType: "faq", heading: textWithFallback(first(value.heading, value.title), "Veelgestelde vragen"), ...(clean(value.intro) ? { intro: legacyPlainText(value.intro) } : {}), items } : null
  }

  if (kind === "cta") {
    const primary = normalizedAction(value.primaryAction ?? value.primary) ?? { label: "Neem contact op", href: "#contact" }
    return { ...base, blockType: "cta", variant: clean(value.variant) === "cta-02" || clean(value.designVariant)?.endsWith("cta-02") ? "cta-02" : "cta-01", ...(clean(value.backgroundMode) ? { backgroundMode: clean(value.backgroundMode) } : {}), heading: textWithFallback(first(value.heading, value.headline, value.title), "Neem contact op"), ...(clean(value.body ?? value.description) ? { body: legacyPlainText(value.body ?? value.description) } : {}), primaryAction: primary, ...(normalizedAction(value.secondaryAction ?? value.secondary) ? { secondaryAction: normalizedAction(value.secondaryAction ?? value.secondary) } : {}), ...(normalizedMedia(value.image ?? value.backgroundImage) ? { image: normalizedMedia(value.image ?? value.backgroundImage) } : {}) }
  }

  if (kind === "contact") {
    const methods = (Array.isArray(value.contactMethods) ? value.contactMethods : Array.isArray(value.items) ? value.items : []).slice(0, 4).map((entry) => {
      const item = record(entry)
      const href = clean(item.href)
      return { kind: href?.startsWith("mailto:") ? "email" : href?.startsWith("tel:") ? "phone" : "other", label: textWithFallback(first(item.label, item.title), "Contact"), value: textWithFallback(first(item.value, item.description), "Neem contact op"), ...(href ? { href } : {}) }
    })
    if (!methods.length) methods.push({ kind: "other", label: "Contact", value: "Neem contact op" })
    return { ...base, blockType: "contact", heading: textWithFallback(first(value.heading, value.title), "Neem contact op"), ...(clean(value.body ?? value.description) ? { body: legacyPlainText(value.body ?? value.description) } : {}), contactMethods: methods }
  }
  return null
}

const removeLegacyMetadata = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(removeLegacyMetadata)
  if (!isRecord(value)) return value
  const output: JsonRecord = {}
  for (const [key, child] of Object.entries(value)) {
    if (key === "providerVariant" || key === "designVariant" || key === "providerProvenance" || key === "providerSource") continue
    if (key === "generator" && isRecord(child)) {
      const generator = { ...child }
      const name = clean(generator.name)
      const version = clean(generator.version)
      if (name?.toLowerCase().includes("shadcn") || name?.toLowerCase().includes("provider")) generator.name = "sitegen-first-party"
      if (version?.toLowerCase().includes("shadcn") || version?.toLowerCase().includes("provider")) generator.version = "sitegen-first-party-migration-v1"
      output[key] = removeLegacyMetadata(generator)
      continue
    }
    output[key] = removeLegacyMetadata(child)
  }
  return output
}

export const normalizeLegacyStoredJson = (value: unknown): unknown => {
  const parsed = jsonValue(value)
  if (Array.isArray(parsed)) return parsed.map(normalizeLegacyStoredJson)
  if (!isRecord(parsed)) return parsed

  const block = canonicalBlock(parsed)
  if (block) return removeLegacyMetadata(block)

  const output: JsonRecord = {}
  for (const [key, child] of Object.entries(parsed)) {
    if (key === "header" && isRecord(child)) {
      output.navbar = { ...normalizeLegacyStoredJson(child) as JsonRecord, variant: "navbar-01" }
      continue
    }
    if (key === "banner" && isRecord(child)) {
      output.announcement = { ...normalizeLegacyStoredJson(child) as JsonRecord, variant: "announcement-01" }
      continue
    }
    output[key] = normalizeLegacyStoredJson(child)
  }
  if (isRecord(output.chrome)) {
    const chrome = output.chrome
    if (isRecord(chrome.navbar)) chrome.navbar = { ...chrome.navbar, variant: "navbar-01" }
    if (isRecord(chrome.announcement)) chrome.announcement = { ...chrome.announcement, variant: "announcement-01" }
    output.chrome = chrome
  }
  if (isRecord(output.navigation) && isRecord(output.navigation.header) && output.navigation.primary == null) {
    const navigation = output.navigation
    output.navigation = { ...navigation, primary: navigation.header }
    delete navigation.header
  }
  if (isRecord(output.systemTemplates) && isRecord(output.systemTemplates.notFound)) {
    output.systemTemplates = { ...output.systemTemplates, notFound: { ...output.systemTemplates.notFound, variant: "not-found-01" } }
  }
  if (isRecord(output.maintenance)) output.maintenance = { ...output.maintenance, variant: "maintenance-01" }
  if (isRecord(output.consent)) output.consent = { ...output.consent, variant: "consent-01" }
  return removeLegacyMetadata(output)
}

export const normalizeLegacySnapshot = (value: unknown): unknown => {
  const normalized = normalizeLegacyStoredJson(value)
  if (!isRecord(normalized)) return normalized

  const snapshot = { ...normalized }
  const tenantId = clean(snapshot.tenantId)
  if (tenantId) snapshot.tenantId = tenantId

  if (isRecord(snapshot.manifest)) {
    const manifest = { ...snapshot.manifest }
    if (tenantId) manifest.tenantId = tenantId
    snapshot.manifest = manifest
  }

  if (isRecord(snapshot.settings)) {
    const settings = { ...snapshot.settings }
    const legacyPrimaryNavigation = Array.isArray(settings.navHeader) ? settings.navHeader : null
    const legacyFooterNavigation = Array.isArray(settings.navFooter) ? settings.navFooter : null
    const navigation = isRecord(settings.navigation) ? { ...settings.navigation } : {}
    if (navigation.primary == null && legacyPrimaryNavigation) navigation.primary = legacyPrimaryNavigation
    if (navigation.footer == null && legacyFooterNavigation) navigation.footer = legacyFooterNavigation
    if (Object.keys(navigation).length > 0) settings.navigation = navigation
    delete settings.navHeader
    delete settings.navFooter

    const chrome = isRecord(settings.chrome) ? { ...settings.chrome } : null
    if (chrome) {
      const announcement = isRecord(chrome.announcement) ? { ...chrome.announcement } : null
      if (announcement) {
        delete announcement.variant
        chrome.announcement = announcement
      }
      settings.chrome = chrome
    }

    const systemTemplates = isRecord(settings.systemTemplates) ? { ...settings.systemTemplates } : null
    if (systemTemplates) {
      const notFound = isRecord(systemTemplates.notFound) ? { ...systemTemplates.notFound } : null
      if (notFound) {
        delete notFound.variant
        systemTemplates.notFound = notFound
      }
      settings.systemTemplates = systemTemplates
    }

    const maintenance = isRecord(settings.maintenance) ? { ...settings.maintenance } : null
    if (maintenance) {
      delete maintenance.variant
      settings.maintenance = maintenance
    }
    snapshot.settings = settings
  }

  const pagesValue = normalized.pages
  if (Array.isArray(pagesValue)) {
    snapshot.pages = pagesValue
      .filter((page): page is JsonRecord => isRecord(page) && page.slug !== "privacy-en-cookieverklaring")
      .map((page) => {
        const normalizedPage = { ...page }
        const pageId = clean(normalizedPage.id)
        if (pageId) normalizedPage.id = pageId
        else delete normalizedPage.id
        normalizedPage.blocks = Array.isArray(page.blocks)
          ? page.blocks.map((block) => canonicalBlock(record(block))).filter((block): block is JsonRecord => Boolean(block))
          : []
        return normalizedPage
      })
  }

  if (Array.isArray(snapshot.blocks)) {
    const blocks = snapshot.blocks.map((entry) => {
      const item = record(entry)
      const slug = legacyBlockType(item.slug ?? item.blockType)
      if (!slug) return null
      const output: JsonRecord = { slug }
      const label = clean(item.label)
      const defaultAnchor = clean(item.defaultAnchor)
      if (label) output.label = label
      if (defaultAnchor) output.defaultAnchor = defaultAnchor
      return output
    }).filter((entry): entry is JsonRecord => Boolean(entry))
    if (blocks.length > 0) snapshot.blocks = blocks
    else delete snapshot.blocks
  }

  return snapshot
}

export const normalizeLegacyManifest = (value: unknown): unknown => {
  const normalized = normalizeLegacyStoredJson(value)
  if (!isRecord(normalized) || !Array.isArray(normalized.blocks)) return normalized
  const blocks = normalized.blocks.map((entry) => {
    const item = record(entry)
    const blockType = legacyBlockType(item.slug)
    return blockType ? { ...item, slug: blockType } : null
  }).filter((entry): entry is { slug: string } => entry !== null)
  return { ...normalized, blocks, version: 1 }
}

/** Materialize an old system privacy block into settings-owned legal content. */
export async function materializeLegacyPrivacyDisclosure(db: Database): Promise<void> {
  const stage = await db.execute(sql`
    SELECT stage_id, page_id, data
    FROM public.sitegen_legacy_block_stage
    WHERE source_table IN ('pages_blocks_content_section', 'pages_blocks_rich_text')
    ORDER BY stage_id;
  `)
  const rows = rowsFrom<{ stage_id: string | number; page_id: number | string | null; data: unknown }>(stage)
  if (!rows.length) return
  const pages = await db.execute(sql`
    SELECT id, tenant_id, slug
    FROM public.pages
    WHERE slug = 'privacy-en-cookieverklaring';
  `)
  const pageById = new Map(rowsFrom<{ id: number | string; tenant_id: number | string; slug: string }>(pages).map((page) => [String(page.id), page]))
  const settings = await db.execute(sql`
    SELECT id, tenant_id, site_name, contact_email, contact_phone, contact_address,
           nap_legal_name, nap_kvk_number, nap_street_address, nap_city, nap_region,
           nap_postal_code, nap_country
    FROM public.site_settings;
  `)
  const settingRows = rowsFrom<{
    id: number | string
    tenant_id: number | string
    site_name: string
    contact_email: string | null
    contact_phone: string | null
    contact_address: string | null
    nap_legal_name: string | null
    nap_kvk_number: string | null
    nap_street_address: string | null
    nap_city: string | null
    nap_region: string | null
    nap_postal_code: string | null
    nap_country: string | null
  }>(settings)
  const settingByTenant = new Map(settingRows.map((setting) => [String(setting.tenant_id), setting]))
  const seenTenants = new Set<string>()
  for (const row of rows) {
    const page = pageById.get(String(row.page_id))
    if (!page) continue
    const tenantKey = String(page.tenant_id)
    if (seenTenants.has(tenantKey)) continue
    seenTenants.add(tenantKey)
    const setting = settingByTenant.get(tenantKey)
    if (!setting) throw new Error(`Cannot materialize privacy disclosure: tenant ${tenantKey} has no site settings row.`)
    const data = record(row.data)
    const email = clean(setting.contact_email)
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`Cannot materialize privacy disclosure for tenant ${tenantKey}: a valid contact email is required.`)
    }
    const address = [setting.nap_street_address, setting.nap_postal_code, setting.nap_city, setting.nap_region, setting.nap_country, setting.contact_address].map(clean).find(Boolean) ?? null
    const body = isRtRoot(data.body) ? jsonValue(data.body) : null
    await db.execute(sql`
      UPDATE public.site_settings
      SET privacy_disclosure_enabled = true,
          privacy_disclosure_mode = 'custom',
          privacy_disclosure_title = ${textWithFallback(data.title, "Privacy- en cookieverklaring")},
          privacy_disclosure_body = ${body ? JSON.stringify(body) : null}::jsonb,
          privacy_disclosure_version = 'tenant-privacy-owned-2026-08-13.1',
          privacy_disclosure_effective_at = '2026-07-10T00:00:00.000Z',
          privacy_disclosure_controller_legal_name = ${clean(setting.nap_legal_name) ?? setting.site_name},
          privacy_disclosure_controller_trade_name = ${setting.site_name},
          privacy_disclosure_controller_email = ${email},
          privacy_disclosure_controller_privacy_email = ${email},
          privacy_disclosure_controller_kvk_number = ${clean(setting.nap_kvk_number)},
          privacy_disclosure_controller_address = ${address},
          privacy_disclosure_contact_methods = ${JSON.stringify({ email: true, phone: Boolean(clean(setting.contact_phone)), whatsapp: false, forms: null })}::jsonb,
          privacy_disclosure_marketing_technologies = '[]'::jsonb,
          privacy_disclosure_additional_processors = '[]'::jsonb
      WHERE id = ${setting.id};
    `)
}
}
