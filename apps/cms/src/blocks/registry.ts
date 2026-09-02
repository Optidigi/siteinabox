import { Hero } from "./Hero"
import { Services } from "./Services"
import { About } from "./About"
import { Process } from "./Process"
import { Work } from "./Work"
import { Reviews } from "./Reviews"
import { Pricing } from "./Pricing"
import { Faq } from "./Faq"
import { Cta } from "./Cta"
import { Contact } from "./Contact"
import { Appointments } from "./Appointments"
import type { BlockWithMeta } from "./_summary"

export const ALL_BLOCKS = [
  Hero,
  Services,
  About,
  Process,
  Work,
  Reviews,
  Pricing,
  Faq,
  Cta,
  Contact,
  Appointments,
] as const

export const BLOCKS = ALL_BLOCKS as readonly BlockWithMeta[]

export const blockBySlug = Object.fromEntries(ALL_BLOCKS.map((b) => [b.slug, b])) as Record<string, BlockWithMeta>

export function resolveAllowedBlocks(
  registry: readonly BlockWithMeta[],
  declared: { slug: string }[] | undefined,
): BlockWithMeta[] {
  if (!declared || declared.length === 0) return [...registry]
  const bySlug = new Map(registry.map((b) => [b.slug, b]))
  const out: BlockWithMeta[] = []
  for (const d of declared) {
    const block = bySlug.get(d.slug)
    if (!block) {
      console.warn(`[resolveAllowedBlocks] manifest declares unknown block slug: ${d.slug}; skipping`)
      continue
    }
    out.push(block)
  }
  return out
}
