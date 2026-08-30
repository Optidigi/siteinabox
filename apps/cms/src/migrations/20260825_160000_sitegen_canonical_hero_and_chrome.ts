import crypto from "node:crypto"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

type JsonRecord = Record<string, unknown>

const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)

const rowsFrom = <T,>(value: unknown): T[] => {
  if (!isRecord(value) || !Array.isArray(value.rows)) return []
  return value.rows as T[]
}

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const record = value as JsonRecord
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`
}

const HERO_VARIANTS = new Set(["hero-01", "hero-02", "hero-03", "hero-04", "hero-05"])

const legacyHeroVariants: Record<string, string> = {
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

const normalizeLegacyHeroName = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const withoutProvider = value.startsWith("shadcnui-blocks.")
    ? value.slice("shadcnui-blocks.".length)
    : value
  if (withoutProvider === "hero") return "hero-01"
  if (HERO_VARIANTS.has(withoutProvider)) return withoutProvider
  return legacyHeroVariants[withoutProvider] ?? null
}

const highlightText = (value: unknown): string | null => {
  if (!isRecord(value)) return null
  const title = typeof value.title === "string" ? value.title.trim() : ""
  const body = typeof value.body === "string" ? value.body.trim() : ""
  if (!title && !body) return null
  if (!title) return body
  if (!body) return title
  return `${title}: ${body}`
}

const appendHighlightsToBody = (body: unknown, highlights: unknown): string | null => {
  if (!Array.isArray(highlights)) return typeof body === "string" ? body : null
  const retained = highlights.map(highlightText).filter((value): value is string => Boolean(value))
  if (retained.length === 0) return typeof body === "string" ? body : null
  const base = typeof body === "string" ? body.trim() : ""
  return [base, ...retained].filter(Boolean).join("\n\n")
}

const normalizeChrome = (value: unknown): unknown => {
  if (!isRecord(value)) return value
  const out = { ...value }
  if (isRecord(out.header) && out.navbar == null) {
    out.navbar = { ...out.header, variant: "navbar-01" }
    delete out.header
  }
  if (isRecord(out.navbar)) {
    out.navbar = { ...out.navbar, variant: "navbar-01" }
  }
  if (isRecord(out.banner) && out.announcement == null) {
    out.announcement = { ...out.banner, variant: "announcement-01" }
    delete out.banner
  }
  if (isRecord(out.announcement)) {
    out.announcement = { ...out.announcement, variant: "announcement-01" }
  }
  return out
}

const normalizeNavigation = (value: unknown): unknown => {
  if (!isRecord(value)) return value
  const out = { ...value }
  if (out.primary == null && out.header != null) {
    out.primary = out.header
    delete out.header
  }
  return out
}

const migrateStoredJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(migrateStoredJson)
  if (!isRecord(value)) return value

  const out: JsonRecord = {}
  for (const [key, child] of Object.entries(value)) {
    if (key === "chrome") out[key] = normalizeChrome(migrateStoredJson(child))
    else if (key === "navigation") out[key] = normalizeNavigation(migrateStoredJson(child))
    else out[key] = migrateStoredJson(child)
  }

  if (isRecord(out.systemTemplates) && isRecord(out.systemTemplates.notFound)) {
    out.systemTemplates = {
      ...out.systemTemplates,
      notFound: { ...out.systemTemplates.notFound, variant: "not-found-01" },
    }
  }
  if (isRecord(out.maintenance)) {
    out.maintenance = { ...out.maintenance, variant: "maintenance-01" }
  }
  if (isRecord(out.consent)) {
    out.consent = { ...out.consent, variant: "consent-01" }
  }

  const legacyVariant = normalizeLegacyHeroName(out.blockType)
  if (legacyVariant) {
    const imageAvailable = out.image != null
    let variant = normalizeLegacyHeroName(out.variant) ?? legacyVariant
    if (variant === "hero-02" && (!Array.isArray(out.serviceHighlights) || !imageAvailable)) {
      variant = imageAvailable ? "hero-03" : "hero-01"
    }
    if (variant !== "hero-01" && !imageAvailable) variant = "hero-01"
    const body = appendHighlightsToBody(out.body, out.highlights)
    out.blockType = "hero"
    out.variant = variant
    if (body != null) out.body = body
    if (variant !== "hero-01" || (Array.isArray(out.highlights) && out.highlights.length === 1)) {
      delete out.highlights
    }
    delete out.eyebrow
    delete out.designVariant
    delete out.providerVariant
    delete out.metadata
  } else if (typeof out.blockType === "string" && out.blockType !== "hero") {
    delete out.variant
    delete out.designVariant
    delete out.providerVariant
    delete out.metadata
  }

  return out
}

type JsonRow = { id: string | number; snapshot?: unknown; data?: unknown }
type GenerationRunRow = {
  id: string | number
  generation_input: unknown
  raw_output: unknown
  parsed_output: unknown
  spec: unknown
  validation: unknown
  apply_result: unknown
}

const updateSnapshotHashes = async (db: MigrateUpArgs["db"]) => {
  const snapshots = await db.execute(sql`
    SELECT id, snapshot
    FROM public.published_site_snapshots
  `)
  for (const row of rowsFrom<JsonRow>(snapshots)) {
    const snapshot = migrateStoredJson(row.snapshot)
    const snapshotHash = crypto.createHash("sha256").update(stableStringify(snapshot)).digest("hex")
    await db.execute(sql`
      UPDATE public.published_site_snapshots
      SET snapshot = ${JSON.stringify(snapshot)}::jsonb,
          snapshot_hash = ${snapshotHash}
      WHERE id = ${row.id}
    `)
  }
}

const updateGenerationRuns = async (db: MigrateUpArgs["db"]) => {
  const runs = await db.execute(sql`
    SELECT id, generation_input, raw_output, parsed_output, spec, validation, apply_result
    FROM public.site_generation_runs
  `)
  for (const row of rowsFrom<GenerationRunRow>(runs)) {
    await db.execute(sql`
      UPDATE public.site_generation_runs
      SET generation_input = ${JSON.stringify(migrateStoredJson(row.generation_input))}::jsonb,
          raw_output = ${JSON.stringify(migrateStoredJson(row.raw_output))}::jsonb,
          parsed_output = ${JSON.stringify(migrateStoredJson(row.parsed_output))}::jsonb,
          spec = ${JSON.stringify(migrateStoredJson(row.spec))}::jsonb,
          validation = ${JSON.stringify(migrateStoredJson(row.validation))}::jsonb,
          apply_result = ${JSON.stringify(migrateStoredJson(row.apply_result))}::jsonb
      WHERE id = ${row.id}
    `)
  }
}

const renameLegacyColumns = async (db: MigrateUpArgs["db"]) => {
  await db.execute(sql`
    DO $do$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'chrome_header_variant') THEN ALTER TABLE public.site_settings RENAME COLUMN chrome_header_variant TO chrome_navbar_variant; END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'chrome_header_logo_id') THEN ALTER TABLE public.site_settings RENAME COLUMN chrome_header_logo_id TO chrome_navbar_logo_id; END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'chrome_header_behavior') THEN ALTER TABLE public.site_settings RENAME COLUMN chrome_header_behavior TO chrome_navbar_behavior; END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'chrome_header_active_mode') THEN ALTER TABLE public.site_settings RENAME COLUMN chrome_header_active_mode TO chrome_navbar_active_mode; END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'chrome_header_mobile_menu') THEN ALTER TABLE public.site_settings RENAME COLUMN chrome_header_mobile_menu TO chrome_navbar_mobile_menu; END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'chrome_header_cta_label') THEN ALTER TABLE public.site_settings RENAME COLUMN chrome_header_cta_label TO chrome_navbar_cta_label; END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'chrome_header_cta_href') THEN ALTER TABLE public.site_settings RENAME COLUMN chrome_header_cta_href TO chrome_navbar_cta_href; END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'chrome_header_cta_external') THEN ALTER TABLE public.site_settings RENAME COLUMN chrome_header_cta_external TO chrome_navbar_cta_external; END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'chrome_header_secondary_action_label') THEN ALTER TABLE public.site_settings RENAME COLUMN chrome_header_secondary_action_label TO chrome_navbar_secondary_action_label; END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'chrome_header_secondary_action_href') THEN ALTER TABLE public.site_settings RENAME COLUMN chrome_header_secondary_action_href TO chrome_navbar_secondary_action_href; END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'chrome_header_secondary_action_external') THEN ALTER TABLE public.site_settings RENAME COLUMN chrome_header_secondary_action_external TO chrome_navbar_secondary_action_external; END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'chrome_header_search_enabled') THEN ALTER TABLE public.site_settings RENAME COLUMN chrome_header_search_enabled TO chrome_navbar_search_enabled; END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'chrome_header_search_action') THEN ALTER TABLE public.site_settings RENAME COLUMN chrome_header_search_action TO chrome_navbar_search_action; END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'chrome_header_search_placeholder') THEN ALTER TABLE public.site_settings RENAME COLUMN chrome_header_search_placeholder TO chrome_navbar_search_placeholder; END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'chrome_banner_variant') THEN ALTER TABLE public.site_settings RENAME COLUMN chrome_banner_variant TO chrome_announcement_variant; END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'chrome_banner_visible') THEN ALTER TABLE public.site_settings RENAME COLUMN chrome_banner_visible TO chrome_announcement_visible; END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'chrome_banner_title') THEN ALTER TABLE public.site_settings RENAME COLUMN chrome_banner_title TO chrome_announcement_title; END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'chrome_banner_message') THEN ALTER TABLE public.site_settings RENAME COLUMN chrome_banner_message TO chrome_announcement_message; END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'chrome_banner_link_label') THEN ALTER TABLE public.site_settings RENAME COLUMN chrome_banner_link_label TO chrome_announcement_link_label; END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'chrome_banner_link_href') THEN ALTER TABLE public.site_settings RENAME COLUMN chrome_banner_link_href TO chrome_announcement_link_href; END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'chrome_banner_link_external') THEN ALTER TABLE public.site_settings RENAME COLUMN chrome_banner_link_external TO chrome_announcement_link_external; END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'chrome_banner_dismissible') THEN ALTER TABLE public.site_settings RENAME COLUMN chrome_banner_dismissible TO chrome_announcement_dismissible; END IF;
    END $do$;

    DO $do$
    BEGIN
      IF to_regclass('public.site_settings_nav_header') IS NOT NULL THEN ALTER TABLE public.site_settings_nav_header RENAME TO site_settings_navigation_primary; END IF;
      IF to_regclass('public.site_settings_nav_header_children') IS NOT NULL THEN ALTER TABLE public.site_settings_nav_header_children RENAME TO site_settings_navigation_primary_children; END IF;
      IF to_regclass('public.site_settings_nav_footer') IS NOT NULL THEN ALTER TABLE public.site_settings_nav_footer RENAME TO site_settings_navigation_footer; END IF;
      IF to_regclass('public.site_settings_nav_footer_children') IS NOT NULL THEN ALTER TABLE public.site_settings_nav_footer_children RENAME TO site_settings_navigation_footer_children; END IF;
    END $do$;

    ALTER INDEX IF EXISTS public.site_settings_nav_header_order_idx RENAME TO site_settings_navigation_primary_order_idx;
    ALTER INDEX IF EXISTS public.site_settings_nav_header_parent_id_idx RENAME TO site_settings_navigation_primary_parent_id_idx;
    ALTER INDEX IF EXISTS public.site_settings_nav_header_page_idx RENAME TO site_settings_navigation_primary_page_idx;
    ALTER INDEX IF EXISTS public.site_settings_nav_header_pkey RENAME TO site_settings_navigation_primary_pkey;
    ALTER INDEX IF EXISTS public.site_settings_nav_header_children_order_idx RENAME TO site_settings_navigation_primary_children_order_idx;
    ALTER INDEX IF EXISTS public.site_settings_nav_header_children_parent_id_idx RENAME TO site_settings_navigation_primary_children_parent_id_idx;
    ALTER INDEX IF EXISTS public.site_settings_nav_header_children_pkey RENAME TO site_settings_navigation_primary_children_pkey;
    ALTER INDEX IF EXISTS public.site_settings_nav_footer_order_idx RENAME TO site_settings_navigation_footer_order_idx;
    ALTER INDEX IF EXISTS public.site_settings_nav_footer_parent_id_idx RENAME TO site_settings_navigation_footer_parent_id_idx;
    ALTER INDEX IF EXISTS public.site_settings_nav_footer_page_idx RENAME TO site_settings_navigation_footer_page_idx;
    ALTER INDEX IF EXISTS public.site_settings_nav_footer_pkey RENAME TO site_settings_navigation_footer_pkey;
    ALTER INDEX IF EXISTS public.site_settings_nav_footer_children_order_idx RENAME TO site_settings_navigation_footer_children_order_idx;
    ALTER INDEX IF EXISTS public.site_settings_nav_footer_children_parent_id_idx RENAME TO site_settings_navigation_footer_children_parent_id_idx;
    ALTER INDEX IF EXISTS public.site_settings_nav_footer_children_pkey RENAME TO site_settings_navigation_footer_children_pkey;
    ALTER INDEX IF EXISTS public.site_settings_chrome_header_chrome_header_logo_idx RENAME TO site_settings_chrome_navbar_chrome_navbar_logo_idx;

    DO $do$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_header__order_not_null') THEN ALTER TABLE public.site_settings_navigation_primary RENAME CONSTRAINT site_settings_nav_header__order_not_null TO site_settings_navigation_primary__order_not_null; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_header__parent_id_not_null') THEN ALTER TABLE public.site_settings_navigation_primary RENAME CONSTRAINT site_settings_nav_header__parent_id_not_null TO site_settings_navigation_primary__parent_id_not_null; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_header_id_not_null') THEN ALTER TABLE public.site_settings_navigation_primary RENAME CONSTRAINT site_settings_nav_header_id_not_null TO site_settings_navigation_primary_id_not_null; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_header_type_not_null') THEN ALTER TABLE public.site_settings_navigation_primary RENAME CONSTRAINT site_settings_nav_header_type_not_null TO site_settings_navigation_primary_type_not_null; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_header_pkey') THEN ALTER TABLE public.site_settings_navigation_primary RENAME CONSTRAINT site_settings_nav_header_pkey TO site_settings_navigation_primary_pkey; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_header_page_id_pages_id_fk') THEN ALTER TABLE public.site_settings_navigation_primary RENAME CONSTRAINT site_settings_nav_header_page_id_pages_id_fk TO site_settings_navigation_primary_page_id_pages_id_fk; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_header_parent_id_fk') THEN ALTER TABLE public.site_settings_navigation_primary RENAME CONSTRAINT site_settings_nav_header_parent_id_fk TO site_settings_navigation_primary_parent_id_fk; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_header_children__order_not_null') THEN ALTER TABLE public.site_settings_navigation_primary_children RENAME CONSTRAINT site_settings_nav_header_children__order_not_null TO site_settings_navigation_primary_children__order_not_null; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_header_children__parent_id_not_null') THEN ALTER TABLE public.site_settings_navigation_primary_children RENAME CONSTRAINT site_settings_nav_header_children__parent_id_not_null TO site_settings_navigation_primary_children__parent_id_not_null; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_header_children_id_not_null') THEN ALTER TABLE public.site_settings_navigation_primary_children RENAME CONSTRAINT site_settings_nav_header_children_id_not_null TO site_settings_navigation_primary_children_id_not_null; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_header_children_pkey') THEN ALTER TABLE public.site_settings_navigation_primary_children RENAME CONSTRAINT site_settings_nav_header_children_pkey TO site_settings_navigation_primary_children_pkey; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_header_children_parent_id_fk') THEN ALTER TABLE public.site_settings_navigation_primary_children RENAME CONSTRAINT site_settings_nav_header_children_parent_id_fk TO site_settings_navigation_primary_children_parent_id_fk; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_footer__order_not_null') THEN ALTER TABLE public.site_settings_navigation_footer RENAME CONSTRAINT site_settings_nav_footer__order_not_null TO site_settings_navigation_footer__order_not_null; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_footer__parent_id_not_null') THEN ALTER TABLE public.site_settings_navigation_footer RENAME CONSTRAINT site_settings_nav_footer__parent_id_not_null TO site_settings_navigation_footer__parent_id_not_null; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_footer_id_not_null') THEN ALTER TABLE public.site_settings_navigation_footer RENAME CONSTRAINT site_settings_nav_footer_id_not_null TO site_settings_navigation_footer_id_not_null; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_footer_type_not_null') THEN ALTER TABLE public.site_settings_navigation_footer RENAME CONSTRAINT site_settings_nav_footer_type_not_null TO site_settings_navigation_footer_type_not_null; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_footer_pkey') THEN ALTER TABLE public.site_settings_navigation_footer RENAME CONSTRAINT site_settings_nav_footer_pkey TO site_settings_navigation_footer_pkey; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_footer_page_id_pages_id_fk') THEN ALTER TABLE public.site_settings_navigation_footer RENAME CONSTRAINT site_settings_nav_footer_page_id_pages_id_fk TO site_settings_navigation_footer_page_id_pages_id_fk; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_footer_parent_id_fk') THEN ALTER TABLE public.site_settings_navigation_footer RENAME CONSTRAINT site_settings_nav_footer_parent_id_fk TO site_settings_navigation_footer_parent_id_fk; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_footer_children__order_not_null') THEN ALTER TABLE public.site_settings_navigation_footer_children RENAME CONSTRAINT site_settings_nav_footer_children__order_not_null TO site_settings_navigation_footer_children__order_not_null; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_footer_children__parent_id_not_null') THEN ALTER TABLE public.site_settings_navigation_footer_children RENAME CONSTRAINT site_settings_nav_footer_children__parent_id_not_null TO site_settings_navigation_footer_children__parent_id_not_null; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_footer_children_id_not_null') THEN ALTER TABLE public.site_settings_navigation_footer_children RENAME CONSTRAINT site_settings_nav_footer_children_id_not_null TO site_settings_navigation_footer_children_id_not_null; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_footer_children_pkey') THEN ALTER TABLE public.site_settings_navigation_footer_children RENAME CONSTRAINT site_settings_nav_footer_children_pkey TO site_settings_navigation_footer_children_pkey; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_nav_footer_children_parent_id_fk') THEN ALTER TABLE public.site_settings_navigation_footer_children RENAME CONSTRAINT site_settings_nav_footer_children_parent_id_fk TO site_settings_navigation_footer_children_parent_id_fk; END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_chrome_header_logo_id_media_id_fk') THEN ALTER TABLE public.site_settings RENAME CONSTRAINT site_settings_chrome_header_logo_id_media_id_fk TO site_settings_chrome_navbar_logo_id_media_id_fk; END IF;
    END $do$;
  `)
}

const normalizeSettingEnums = async (db: MigrateUpArgs["db"]) => {
  await db.execute(sql`
    ALTER TABLE public.site_settings
      ALTER COLUMN chrome_navbar_variant DROP DEFAULT,
      ALTER COLUMN chrome_navbar_variant SET DATA TYPE text USING chrome_navbar_variant::text,
      ALTER COLUMN chrome_footer_variant DROP DEFAULT,
      ALTER COLUMN chrome_footer_variant SET DATA TYPE text USING chrome_footer_variant::text,
      ALTER COLUMN chrome_announcement_variant DROP DEFAULT,
      ALTER COLUMN chrome_announcement_variant SET DATA TYPE text USING chrome_announcement_variant::text,
      ALTER COLUMN system_templates_not_found_variant DROP DEFAULT,
      ALTER COLUMN system_templates_not_found_variant SET DATA TYPE text USING system_templates_not_found_variant::text,
      ALTER COLUMN maintenance_variant DROP DEFAULT,
      ALTER COLUMN maintenance_variant SET DATA TYPE text USING maintenance_variant::text;

    UPDATE public.site_settings SET
      chrome_navbar_variant = 'navbar-01',
      chrome_footer_variant = 'footer-01',
      chrome_announcement_variant = 'announcement-01',
      system_templates_not_found_variant = 'not-found-01',
      maintenance_variant = 'maintenance-01';

    DROP TYPE IF EXISTS public.enum_site_settings_chrome_navbar_variant;
    DROP TYPE IF EXISTS public.enum_site_settings_chrome_footer_variant;
    DROP TYPE IF EXISTS public.enum_site_settings_chrome_announcement_variant;
    DROP TYPE IF EXISTS public.enum_site_settings_system_templates_not_found_variant;
    DROP TYPE IF EXISTS public.enum_site_settings_maintenance_variant;
    CREATE TYPE public.enum_site_settings_chrome_navbar_variant AS ENUM ('navbar-01');
    CREATE TYPE public.enum_site_settings_chrome_footer_variant AS ENUM ('footer-01');
    CREATE TYPE public.enum_site_settings_chrome_announcement_variant AS ENUM ('announcement-01');
    CREATE TYPE public.enum_site_settings_system_templates_not_found_variant AS ENUM ('not-found-01');
    CREATE TYPE public.enum_site_settings_maintenance_variant AS ENUM ('maintenance-01');

    ALTER TABLE public.site_settings
      ALTER COLUMN chrome_navbar_variant SET DEFAULT 'navbar-01'::public.enum_site_settings_chrome_navbar_variant,
      ALTER COLUMN chrome_navbar_variant SET DATA TYPE public.enum_site_settings_chrome_navbar_variant USING chrome_navbar_variant::public.enum_site_settings_chrome_navbar_variant,
      ALTER COLUMN chrome_footer_variant SET DEFAULT 'footer-01'::public.enum_site_settings_chrome_footer_variant,
      ALTER COLUMN chrome_footer_variant SET DATA TYPE public.enum_site_settings_chrome_footer_variant USING chrome_footer_variant::public.enum_site_settings_chrome_footer_variant,
      ALTER COLUMN chrome_announcement_variant SET DEFAULT 'announcement-01'::public.enum_site_settings_chrome_announcement_variant,
      ALTER COLUMN chrome_announcement_variant SET DATA TYPE public.enum_site_settings_chrome_announcement_variant USING chrome_announcement_variant::public.enum_site_settings_chrome_announcement_variant,
      ALTER COLUMN system_templates_not_found_variant SET DEFAULT 'not-found-01'::public.enum_site_settings_system_templates_not_found_variant,
      ALTER COLUMN system_templates_not_found_variant SET DATA TYPE public.enum_site_settings_system_templates_not_found_variant USING system_templates_not_found_variant::public.enum_site_settings_system_templates_not_found_variant,
      ALTER COLUMN maintenance_variant SET DEFAULT 'maintenance-01'::public.enum_site_settings_maintenance_variant,
      ALTER COLUMN maintenance_variant SET DATA TYPE public.enum_site_settings_maintenance_variant USING maintenance_variant::public.enum_site_settings_maintenance_variant;

    DO $do$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_site_settings_chrome_header_variant') THEN ALTER TYPE public.enum_site_settings_chrome_header_variant RENAME TO enum_site_settings_chrome_navbar_variant_legacy; END IF;
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_site_settings_chrome_header_behavior') THEN ALTER TYPE public.enum_site_settings_chrome_header_behavior RENAME TO enum_site_settings_chrome_navbar_behavior; END IF;
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_site_settings_chrome_header_active_mode') THEN ALTER TYPE public.enum_site_settings_chrome_header_active_mode RENAME TO enum_site_settings_chrome_navbar_active_mode; END IF;
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_site_settings_chrome_header_mobile_menu') THEN ALTER TYPE public.enum_site_settings_chrome_header_mobile_menu RENAME TO enum_site_settings_chrome_navbar_mobile_menu; END IF;
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_site_settings_chrome_banner_variant') THEN ALTER TYPE public.enum_site_settings_chrome_banner_variant RENAME TO enum_site_settings_chrome_announcement_variant_legacy; END IF;
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_site_settings_nav_header_type') THEN ALTER TYPE public.enum_site_settings_nav_header_type RENAME TO enum_site_settings_navigation_primary_type; END IF;
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_site_settings_nav_header_children_icon') THEN ALTER TYPE public.enum_site_settings_nav_header_children_icon RENAME TO enum_site_settings_navigation_primary_children_icon; END IF;
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_site_settings_nav_footer_type') THEN ALTER TYPE public.enum_site_settings_nav_footer_type RENAME TO enum_site_settings_navigation_footer_type; END IF;
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_site_settings_nav_footer_children_icon') THEN ALTER TYPE public.enum_site_settings_nav_footer_children_icon RENAME TO enum_site_settings_navigation_footer_children_icon; END IF;
    END $do$;

    DROP TYPE IF EXISTS public.enum_site_settings_chrome_navbar_variant_legacy;
    DROP TYPE IF EXISTS public.enum_site_settings_chrome_announcement_variant_legacy;
  `)
}

const addConsentColumns = async (db: MigrateUpArgs["db"]) => {
  await db.execute(sql`
    CREATE TYPE public.enum_site_settings_consent_variant AS ENUM ('consent-01');
    ALTER TABLE public.site_settings
      ADD COLUMN IF NOT EXISTS consent_variant public.enum_site_settings_consent_variant DEFAULT 'consent-01',
      ADD COLUMN IF NOT EXISTS consent_visible boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS consent_title varchar,
      ADD COLUMN IF NOT EXISTS consent_message varchar,
      ADD COLUMN IF NOT EXISTS consent_accept_label varchar,
      ADD COLUMN IF NOT EXISTS consent_reject_label varchar,
      ADD COLUMN IF NOT EXISTS consent_privacy_link_label varchar,
      ADD COLUMN IF NOT EXISTS consent_privacy_link_href varchar,
      ADD COLUMN IF NOT EXISTS consent_privacy_link_external boolean;
  `)
}

const migrateHeroTables = async (db: MigrateUpArgs["db"]) => {
  await db.execute(sql`
    CREATE TYPE public.enum_pages_blocks_hero_variant AS ENUM ('hero-01', 'hero-02', 'hero-03', 'hero-04', 'hero-05');
    ALTER TABLE public.pages_blocks_hero
      ADD COLUMN IF NOT EXISTS variant public.enum_pages_blocks_hero_variant DEFAULT 'hero-01' NOT NULL,
      ADD COLUMN IF NOT EXISTS image_id integer;
  `)

  await db.execute(sql`
    CREATE TABLE public.pages_blocks_hero_service_highlights (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      id varchar PRIMARY KEY NOT NULL,
      title varchar NOT NULL,
      body varchar NOT NULL,
      hero_heading varchar,
      hero_body varchar,
      primary_action_label varchar,
      primary_action_href varchar,
      secondary_action_label varchar,
      secondary_action_href varchar,
      image_id integer
    );
    ALTER TABLE public.pages_blocks_hero_service_highlights
      ADD CONSTRAINT pages_blocks_hero_service_highlights_parent_id_fk
      FOREIGN KEY ("_parent_id") REFERENCES public.pages_blocks_hero(id) ON DELETE cascade ON UPDATE no action;
    ALTER TABLE public.pages_blocks_hero_service_highlights
      ADD CONSTRAINT pages_blocks_hero_service_highlights_image_id_media_id_fk
      FOREIGN KEY (image_id) REFERENCES public.media(id) ON DELETE set null ON UPDATE no action;
    CREATE INDEX pages_blocks_hero_service_highlights_order_idx ON public.pages_blocks_hero_service_highlights USING btree ("_order");
    CREATE INDEX pages_blocks_hero_service_highlights_parent_id_idx ON public.pages_blocks_hero_service_highlights USING btree ("_parent_id");
    CREATE INDEX pages_blocks_hero_service_highlights_image_idx ON public.pages_blocks_hero_service_highlights USING btree (image_id);

    DO $do$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pages_blocks_hero_image_id_media_id_fk') THEN
        ALTER TABLE public.pages_blocks_hero
          ADD CONSTRAINT pages_blocks_hero_image_id_media_id_fk
          FOREIGN KEY (image_id) REFERENCES public.media(id) ON DELETE set null ON UPDATE no action;
      END IF;
    END $do$;
    CREATE INDEX IF NOT EXISTS pages_blocks_hero_image_idx ON public.pages_blocks_hero USING btree (image_id);
  `)

  await db.execute(sql`
    DO $do$
    DECLARE collision_count bigint;
    BEGIN
      IF to_regclass('public.pages_blocks_hero_service_panel') IS NOT NULL THEN
        EXECUTE 'SELECT count(*) FROM public.pages_blocks_hero_service_panel old_block INNER JOIN public.pages_blocks_hero new_block ON new_block.id = old_block.id' INTO collision_count;
        IF collision_count > 0 THEN RAISE EXCEPTION USING MESSAGE = 'Cannot migrate heroServicePanel rows because a hero row already uses the same id', HINT = 'Restore from backup and resolve the duplicate block id before retrying.'; END IF;
        EXECUTE 'SELECT count(*) FROM public.pages_blocks_hero_service_panel_service_highlights old_child INNER JOIN public.pages_blocks_hero_service_highlights new_child ON new_child.id = old_child.id' INTO collision_count;
        IF collision_count > 0 THEN RAISE EXCEPTION USING MESSAGE = 'Cannot migrate service highlight rows because a target row already uses the same id', HINT = 'Restore from backup and resolve the duplicate child id before retrying.'; END IF;
        EXECUTE $query$
          INSERT INTO public.pages_blocks_hero ("_order", "_parent_id", "_path", id, heading, body, primary_action_label, primary_action_href, secondary_action_label, secondary_action_href, image_id, anchor, block_name, variant)
          SELECT "_order", "_parent_id", "_path", id, heading, body, primary_action_label, primary_action_href, secondary_action_label, secondary_action_href, image_id, anchor, block_name, 'hero-02'::public.enum_pages_blocks_hero_variant
          FROM public.pages_blocks_hero_service_panel
        $query$;
        EXECUTE $query$
          INSERT INTO public.pages_blocks_hero_service_highlights ("_order", "_parent_id", id, title, body, hero_heading, hero_body, primary_action_label, primary_action_href, secondary_action_label, secondary_action_href, image_id)
          SELECT child."_order", child."_parent_id", child.id, child.title, child.body, child.hero_heading, child.hero_body, child.primary_action_label, child.primary_action_href, child.secondary_action_label, child.secondary_action_href, child.image_id
          FROM public.pages_blocks_hero_service_panel_service_highlights child
        $query$;
      END IF;

      IF to_regclass('public.pages_blocks_hero_angled') IS NOT NULL THEN
        EXECUTE 'SELECT count(*) FROM public.pages_blocks_hero_angled old_block INNER JOIN public.pages_blocks_hero new_block ON new_block.id = old_block.id' INTO collision_count;
        IF collision_count > 0 THEN RAISE EXCEPTION USING MESSAGE = 'Cannot migrate heroAngled rows because a hero row already uses the same id', HINT = 'Restore from backup and resolve the duplicate block id before retrying.'; END IF;
        EXECUTE $query$
          INSERT INTO public.pages_blocks_hero ("_order", "_parent_id", "_path", id, heading, body, primary_action_label, primary_action_href, secondary_action_label, secondary_action_href, image_id, anchor, block_name, variant)
          SELECT old_block."_order", old_block."_parent_id", old_block."_path", old_block.id, old_block.heading,
            concat_ws(E'\n\n', old_block.body, (SELECT string_agg(concat_ws(': ', child.title, child.body), E'\n\n' ORDER BY child."_order") FROM public.pages_blocks_hero_angled_highlights child WHERE child."_parent_id" = old_block.id)),
            old_block.primary_action_label, old_block.primary_action_href, old_block.secondary_action_label, old_block.secondary_action_href, old_block.image_id, old_block.anchor, old_block.block_name, 'hero-03'::public.enum_pages_blocks_hero_variant
          FROM public.pages_blocks_hero_angled old_block
        $query$;
      END IF;

      IF to_regclass('public.pages_blocks_hero_framed') IS NOT NULL THEN
        EXECUTE 'SELECT count(*) FROM public.pages_blocks_hero_framed old_block INNER JOIN public.pages_blocks_hero new_block ON new_block.id = old_block.id' INTO collision_count;
        IF collision_count > 0 THEN RAISE EXCEPTION USING MESSAGE = 'Cannot migrate heroFramed rows because a hero row already uses the same id', HINT = 'Restore from backup and resolve the duplicate block id before retrying.'; END IF;
        EXECUTE $query$
          INSERT INTO public.pages_blocks_hero ("_order", "_parent_id", "_path", id, heading, body, primary_action_label, primary_action_href, secondary_action_label, secondary_action_href, image_id, anchor, block_name, variant)
          SELECT "_order", "_parent_id", "_path", id, heading, body, primary_action_label, primary_action_href, secondary_action_label, secondary_action_href, image_id, anchor, block_name, 'hero-04'::public.enum_pages_blocks_hero_variant
          FROM public.pages_blocks_hero_framed
        $query$;
      END IF;
    END $do$;
  `)

  await db.execute(sql`
    DROP TABLE IF EXISTS public.pages_blocks_hero_service_panel_service_highlights CASCADE;
    DROP TABLE IF EXISTS public.pages_blocks_hero_service_panel CASCADE;
    DROP TABLE IF EXISTS public.pages_blocks_hero_angled_highlights CASCADE;
    DROP TABLE IF EXISTS public.pages_blocks_hero_angled CASCADE;
    DROP TABLE IF EXISTS public.pages_blocks_hero_framed CASCADE;
    DROP TABLE IF EXISTS public.pages_blocks_hero_pattern_split CASCADE;
  `)
}

const normalizeBlockPresets = async (db: MigrateUpArgs["db"]) => {
  const presets = await db.execute(sql`SELECT id, data FROM public.block_presets`)
  for (const row of rowsFrom<JsonRow>(presets)) {
    await db.execute(sql`
      UPDATE public.block_presets
      SET data = ${JSON.stringify(migrateStoredJson(row.data))}::jsonb
      WHERE id = ${row.id}
    `)
  }
  await db.execute(sql`
    ALTER TABLE public.block_presets ALTER COLUMN block_type SET DATA TYPE text;
    UPDATE public.block_presets SET block_type = regexp_replace(block_type, '^shadcnui-blocks\\.', '');
    UPDATE public.block_presets SET block_type = CASE
      WHEN block_type LIKE 'hero%' THEN 'hero'
      WHEN block_type IN ('featureList', 'integrations') THEN 'services'
      WHEN block_type IN ('testimonials') THEN 'reviews'
      WHEN block_type IN ('contactSection', 'contactDetails') THEN 'contact'
      WHEN block_type IN ('gallery') THEN 'work'
      WHEN block_type IN ('timeline') THEN 'process'
      WHEN block_type IN ('team') THEN 'about'
      WHEN block_type IN ('blogCards') THEN 'richText'
      ELSE block_type
    END;
    DO $do$
    BEGIN
      IF EXISTS (SELECT 1 FROM public.block_presets WHERE block_type NOT IN ('hero', 'services', 'about', 'process', 'work', 'reviews', 'pricing', 'faq', 'cta', 'contact', 'richText')) THEN
        RAISE EXCEPTION USING MESSAGE = 'Cannot canonicalize an unknown block preset type', HINT = 'Review the block_presets rows and map them to a supported first-party semantic family before retrying.';
      END IF;
    END $do$;
    DROP TYPE IF EXISTS public.enum_block_presets_block_type;
    CREATE TYPE public.enum_block_presets_block_type AS ENUM ('hero', 'services', 'about', 'process', 'work', 'reviews', 'pricing', 'faq', 'cta', 'contact', 'richText');
    ALTER TABLE public.block_presets ALTER COLUMN block_type SET DATA TYPE public.enum_block_presets_block_type USING block_type::public.enum_block_presets_block_type;
  `)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await renameLegacyColumns(db)
  await normalizeSettingEnums(db)
  await addConsentColumns(db)
  await migrateHeroTables(db)
  await normalizeBlockPresets(db)
  await updateSnapshotHashes(db)
  await updateGenerationRuns(db)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error("This migration canonicalizes hero/chrome data and removes legacy tables; restore a database backup to roll it back.")
}
