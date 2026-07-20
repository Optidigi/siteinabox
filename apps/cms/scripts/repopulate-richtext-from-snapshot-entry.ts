/**
 * Bundle entry-point for `dist-runtime/repopulate-richtext-from-snapshot.bundled.mjs`.
 *
 * One-off repopulation tool for post-rt-v2-migration recovery. The
 * 20260513_180426_rt_v2_fields schema migration is destructive — it
 * converts varchar rich-text columns to jsonb USING NULL, wiping
 * existing content. This script reads from a snapshot of the OLD
 * projection JSON files (still in HTML-string format), runs the
 * HTML→RtNode mapper, and writes the resulting RtRoot values back
 * via payload.update — which triggers the page's afterChange hook,
 * which re-projects the page JSON to disk in NEW format.
 *
 * Intended invocation (inside the prod siteinabox-cms container):
 *
 *   docker exec siteinabox-cms node \
 *     /app/dist-runtime/repopulate-richtext-from-snapshot.bundled.mjs \
 *     --tenant amicare-zorg \
 *     --snapshot /data-out/_repopulate/7/pages/index.json \
 *     [--dry-run]
 *
 * Args:
 *   --tenant <slug>     — tenant slug to look up (required)
 *   --snapshot <path>   — path to OLD-format page JSON file (required)
 *   --dry-run           — log mapped blocks without writing
 *
 * Source-of-truth: the OLD projection JSON has block fields as plain
 * HTML strings (eyebrow: "...", headline: "<em>foo</em>", etc.). For
 * each block the script looks up the field-name → RT-variant mapping
 * (hero.eyebrow → inline, hero.subheadline → block, etc.) and runs
 * `mapHtmlToRt` with the tenant's manifest + themed matchers loaded
 * via the same helpers the editor uses (`loadTenantManifest`,
 * `matchersForManifest`).
 *
 * Block coverage matches what the OLD format stored as RT strings:
 *   hero: eyebrow, headline, subheadline
 *   featureList: title, intro, features[*].title, features[*].description
 *   faq: title, items[*].question, items[*].answer
 *   cta: headline, description
 *   contactSection: title, description
 *   richText: body
 *   testimonials: nothing (per the schema these stayed as plain text)
 *
 * Idempotent against re-runs ONLY when the snapshot is the canonical
 * source: a second run would re-write the same RtRoot output. Running
 * with --snapshot pointing at a NEW-format file (where fields are
 * already RtRoot objects, not HTML strings) skips them silently
 * because `typeof raw !== "string"`.
 */
import { getPayload } from "payload"
import { readFileSync } from "node:fs"
import config from "@/payload.config"
import { mapHtmlToRt } from "@/lib/richText/mapper"
import { matchersForManifest } from "@/lib/richText/themedMatchers/index"
import { rtRootSchema } from "@/lib/richText/rtNodeSchema"
import { validateAgainstManifest } from "@/lib/richText/validateAgainstManifest"
import type { Page, Tenant } from "@/payload-types"
import type { RtRoot } from "@/lib/richText/RtNode"

type BlockRecord = Record<string, unknown> & { blockType: string }

// `loadTenantManifest` lives in a module that imports `server-only`. esbuild
// inlines the throw into the bundled output, which fires at import time
// (this script runs from a plain node process, not from Next.js's webpack
// runtime that shims server-only away). Same workaround as
// validateRichTextOnSave: defer the import to inside main() so it only
// resolves at execution time, after we're committed to running.

process.env.PAYLOAD_DISABLE_ADMIN = "true"
process.stdin.destroy()

type CliArgs = { tenant?: string; snapshot?: string; dryRun: boolean }

const parseArgs = (): CliArgs => {
  const a = process.argv.slice(2)
  const out: CliArgs = { dryRun: false }
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--tenant") out.tenant = a[++i]
    else if (a[i] === "--snapshot") out.snapshot = a[++i]
    else if (a[i] === "--dry-run") out.dryRun = true
  }
  return out
}

const fieldVariant = (blockType: string, fieldName: string): "block" | "inline" => {
  if (blockType === "richText" && fieldName === "body") return "block"
  if (blockType === "hero" && (fieldName === "eyebrow" || fieldName === "headline")) return "inline"
  if (blockType === "hero" && fieldName === "subheadline") return "block"
  if (blockType === "featureList" && fieldName === "title") return "inline"
  if (blockType === "featureList" && fieldName === "intro") return "block"
  if (blockType === "featureList" && (fieldName === "feature.title")) return "inline"
  if (blockType === "featureList" && (fieldName === "feature.description")) return "block"
  if (blockType === "faq" && fieldName === "title") return "inline"
  if (blockType === "faq" && fieldName === "item.question") return "inline"
  if (blockType === "faq" && fieldName === "item.answer") return "block"
  if (blockType === "cta" && fieldName === "headline") return "inline"
  if (blockType === "cta" && fieldName === "description") return "block"
  if (blockType === "contactSection" && fieldName === "title") return "inline"
  if (blockType === "contactSection" && fieldName === "description") return "block"
  return "block"
}

const topLevelFields = (blockType: string): string[] => {
  switch (blockType) {
    case "richText":        return ["body"]
    case "hero":            return ["eyebrow", "headline", "subheadline"]
    case "featureList":     return ["title", "intro"]
    case "faq":             return ["title"]
    case "cta":             return ["headline", "description"]
    case "contactSection":  return ["title", "description"]
    default:                return []
  }
}

const main = async () => {
  const args = parseArgs()
  if (!args.tenant || !args.snapshot) {
    console.error("usage: --tenant <slug> --snapshot <path> [--dry-run]")
    process.exit(1)
  }

  const payload = await getPayload({ config })

  const tenants = await payload.find({
    collection: "tenants",
    where: { slug: { equals: args.tenant } },
    limit: 1,
    overrideAccess: true,
  })
  const tenant = tenants.docs[0] as Tenant | undefined
  if (!tenant) {
    console.error(`[repopulate] tenant slug "${args.tenant}" not found`)
    process.exit(1)
  }

  const { loadTenantManifest } = await import("@/lib/richText/loadManifest")
  const manifest = await loadTenantManifest(tenant.id)
  const matchers = matchersForManifest(manifest)

  const snapshot = JSON.parse(readFileSync(args.snapshot, "utf8"))
  const slug = snapshot.slug
  if (!slug) {
    console.error(`[repopulate] snapshot has no slug`)
    process.exit(1)
  }

  const pages = await payload.find({
    collection: "pages",
    where: {
      and: [
        { tenant: { equals: tenant.id } },
        { slug: { equals: slug } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  })
  const page = pages.docs[0] as Page | undefined
  if (!page) {
    console.error(`[repopulate] target page tenant=${tenant.id} slug=${slug} not found in DB`)
    process.exit(1)
  }

  let mapCount = 0
  let errors = 0

  const mapField = (blockType: string, field: string, raw: unknown, label: string): unknown => {
    if (typeof raw !== "string") return raw
    const variant = fieldVariant(blockType, field)
    const rt = mapHtmlToRt(raw, { variant, manifest, themedMatchers: matchers })
    const struct = rtRootSchema.safeParse(rt)
    if (!struct.success) {
      errors++
      console.error(`[repopulate] schema FAIL ${label}: ${struct.error.issues[0]?.message ?? "?"}`)
      return raw
    }
    const validation = validateAgainstManifest(struct.data as RtRoot, manifest)
    if (!validation.ok) {
      errors++
      console.error(`[repopulate] manifest FAIL ${label}: ${validation.errors.join("; ")}`)
      return raw
    }
    mapCount++
    return rt
  }

  // OVERLAY strategy: the DB blocks already have correct upload-relation ids
  // (image, etc.), pills, primary/secondary CTAs, formName, fields[] — all
  // preserved because the rt_v2_fields migration only touches RT columns.
  // Re-using a snapshot block as the write target would re-introduce
  // populated upload objects ({ url, filename, ... }) where Payload expects a
  // bare id, and would invent fresh internal block ids. Instead: take each DB
  // block as the base, find the matching snapshot block by position +
  // blockType, and overlay only the mapped RT fields. Everything else stays
  // as the DB had it.
  const dbBlocks = (page.blocks ?? []) as BlockRecord[]
  const snapBlocks = (snapshot.blocks ?? []) as BlockRecord[]
  if (dbBlocks.length !== snapBlocks.length) {
    console.warn(`[repopulate] block-count mismatch: db=${dbBlocks.length} snapshot=${snapBlocks.length} — overlaying by position; trailing blocks unchanged`)
  }

  const newBlocks = dbBlocks.map((dbBlock, i) => {
    const snapBlock = snapBlocks[i]
    if (!snapBlock || snapBlock.blockType !== dbBlock.blockType) {
      console.warn(`[repopulate] block ${i} blockType mismatch (db=${dbBlock.blockType} snap=${snapBlock?.blockType ?? "?"}) — keeping DB block as-is`)
      return dbBlock
    }
    const out: BlockRecord = { ...dbBlock }

    for (const f of topLevelFields(dbBlock.blockType)) {
      const rawFromSnap = snapBlock[f]
      out[f] = mapField(dbBlock.blockType, f, rawFromSnap, `${dbBlock.blockType}.${f}`)
    }

    if (dbBlock.blockType === "featureList" && Array.isArray(dbBlock.features) && Array.isArray(snapBlock.features)) {
      out.features = dbBlock.features.map((dbFeat: BlockRecord, j: number) => {
        const snapFeat = snapBlock.features[j]
        if (!snapFeat) return dbFeat
        return {
          ...dbFeat,
          title: mapField("featureList", "feature.title", snapFeat.title, `featureList.features[${j}].title`),
          description: mapField("featureList", "feature.description", snapFeat.description, `featureList.features[${j}].description`),
        }
      })
    }

    if (dbBlock.blockType === "faq" && Array.isArray(dbBlock.items) && Array.isArray(snapBlock.items)) {
      out.items = dbBlock.items.map((dbItem: BlockRecord, j: number) => {
        const snapItem = snapBlock.items[j]
        if (!snapItem) return dbItem
        return {
          ...dbItem,
          question: mapField("faq", "item.question", snapItem.question, `faq.items[${j}].question`),
          answer: mapField("faq", "item.answer", snapItem.answer, `faq.items[${j}].answer`),
        }
      })
    }

    return out
  })

  console.log(`[repopulate] tenant=${args.tenant} slug=${slug} blocks=${newBlocks.length} mapped=${mapCount} errors=${errors}`)

  if (args.dryRun) {
    console.log(JSON.stringify(newBlocks, null, 2))
    await payload.db.destroy?.()
    process.exit(errors > 0 ? 2 : 0)
  }

  if (errors > 0) {
    console.error(`[repopulate] HALT — ${errors} mapping errors; pass --dry-run to inspect`)
    await payload.db.destroy?.()
    process.exit(2)
  }

  await payload.update({
    collection: "pages",
    id: page.id,
    data: { blocks: newBlocks as Page["blocks"] },
    overrideAccess: true,
  })

  console.log(`[repopulate] OK — page id=${page.id} updated; afterChange hook re-projects to disk`)

  await payload.db.destroy?.()
  process.exit(0)
}

main().catch((err) => {
  console.error("[repopulate] CRASH:", err)
  process.exit(1)
})
