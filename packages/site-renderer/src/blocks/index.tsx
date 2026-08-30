import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import { assertNever } from "./shared"
import { AboutBlockView } from "./about/AboutBlock"
import { ContactBlockView } from "./contact/ContactBlock"
import { CtaBlockView } from "./cta/CtaBlock"
import { FaqBlockView } from "./faq/FaqBlock"
import { HeroBlockView } from "./hero/HeroBlock"
import { ProcessBlockView } from "./process/ProcessBlock"
import { PricingBlockView } from "./pricing/PricingBlock"
import { ReviewsBlockView } from "./reviews/ReviewsBlock"
import { ServicesBlockView } from "./services/ServicesBlock"
import { WorkBlockView } from "./work/WorkBlock"
import type { BlockRenderOptions } from "./types"

export type { BlockEditSlots, BlockRenderOptions, RendererElementPath } from "./types"

export function BlockRenderer({ block, options }: { block: Block; options: BlockRenderOptions }) {
  switch (block.blockType) {
    case "hero": return <HeroBlockView block={block} options={options} />
    case "services": return <ServicesBlockView block={block} options={options} />
    case "about": return <AboutBlockView block={block} options={options} />
    case "process": return <ProcessBlockView block={block} options={options} />
    case "work": return <WorkBlockView block={block} options={options} />
    case "reviews": return <ReviewsBlockView block={block} options={options} />
    case "pricing": return <PricingBlockView block={block} options={options} />
    case "faq": return <FaqBlockView block={block} options={options} />
    case "cta": return <CtaBlockView block={block} options={options} />
    case "contact": return <ContactBlockView block={block} options={options} />
    default: return assertNever(block)
  }
}
