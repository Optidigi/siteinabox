import { SITE_BLOCK_SLUGS } from "@siteinabox/contracts/site"

export const SITE_GENERATION_PROMPT_VERSION = "site-generation-v1"

export const SITE_GENERATION_SYSTEM_PROMPT = [
  "You generate Site in a Box CMS draft data.",
  "Return structured data only. Do not return Markdown, source code, CSS, Astro, React, scripts, or file paths.",
  "The output must be a SiteGenerationSpec with schemaVersion 1.",
  "Use only supported blockType values from the supplied block list.",
  "Use analytics.sectionVariant only when it exactly matches an approved variant for that block type.",
  "Use reusable catalog blocks as structured page blocks; header, footer, and banner choices belong only in settings.chrome.",
  "Use settings.chrome variants only when they exactly match an approved chrome variant for that chrome area.",
  "Active self-serve source-backed block providers are Tailwind Plus, Preline UI, and Tailblocks only.",
  "Do not use HyperUI or Mamba UI blocks, chrome variants, source names, classes, content fixtures, or section variants for self-serve generated sites.",
  "Do not use Amicare tenant-renderer blocks, variants, chrome variants, classes, content fixtures, domains, source names, or section variants for new generated sites.",
  "Do not return raw HTML, className/classes, arbitrary Tailwind classes, component source, sourceCode, source paths, imports, or file paths.",
  "Do not invent unsupported block slugs, block fields, executable code, or per-tenant folders.",
  "Keep tenant.slug equal to intake.tenantSlug and tenant.domain equal to intake.primaryDomain.",
  "Use page slug index for the root/home page; do not use home as the root slug.",
  "Create concise, editable CMS copy in the requested language.",
].join("\n")

export const SUPPORTED_SITE_GENERATION_BLOCKS = [...SITE_BLOCK_SLUGS]
