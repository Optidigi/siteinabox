import * as React from "react"
import type { HeroBlock } from "@siteinabox/contracts"
import { cn } from "@siteinabox/ui/lib/utils"
import type { BlockRenderOptions } from "../types"
import { HeroBackground, HeroInner, HeroSection, HeroText, HeroValuePoints, resolveBackgroundMode } from "./HeroShared"
import { HeroAngledBlockView } from "./HeroAngledBlock"
import { HeroFramedBlockView } from "./HeroFramedBlock"
import { HeroPatternSplitBlockView } from "./HeroPatternSplitBlock"
import { HeroServicePanelBlockView } from "./HeroServicePanelBlock"

function Hero01BlockView({ block, options }: { block: HeroBlock; options: BlockRenderOptions }) {
  const backgroundMode = resolveBackgroundMode(options, block.backgroundMode)
  const isImageBackground = backgroundMode === "image" && Boolean(block.image)

  return (
    <HeroSection
      options={options}
      design="lead"
      className="relative overflow-hidden bg-background"
    >
      <HeroBackground media={block.image} options={options} mode={backgroundMode} fallbackAlt={block.heading} />
      <HeroInner className="relative z-30 w-full">
        <HeroText
          block={block}
          options={options}
          align="center"
          actionStyle="lead"
          overlayContent
          backgroundMode={backgroundMode}
          className={cn(
            "mx-auto w-full max-w-2xl [&>p]:max-w-xl [&>p]:text-lg [&>p]:leading-8 sm:[&>p]:text-xl sm:[&>p]:leading-9",
            isImageBackground && "hero-on-media-actions text-[var(--on-media)] [&_h1]:text-[var(--on-media)] [&_h2]:text-[var(--on-media)]",
          )}
          headingClassName="mx-auto text-4xl leading-[1.02] sm:text-6xl lg:text-7xl"
        />
        {block.highlights && block.highlights.length > 0 ? <HeroValuePoints highlights={block.highlights} options={options} iconSize={30} presentation="proof-band" className="hero-lead-value-points" /> : null}
      </HeroInner>
    </HeroSection>
  )
}

export function HeroBlockView({ block, options }: { block: HeroBlock; options: BlockRenderOptions }) {
  switch (block.variant) {
    case "hero-01":
      return <Hero01BlockView block={block} options={options} />
    case "hero-02":
      return <HeroServicePanelBlockView block={block} options={options} />
    case "hero-03":
      return <HeroAngledBlockView block={block} options={options} />
    case "hero-04":
      return <HeroFramedBlockView block={block} options={options} />
    case "hero-05":
      return <HeroPatternSplitBlockView block={block} options={options} />
    default: {
      const exhaustive: never = block.variant
      throw new Error(`Unsupported hero variant: ${String(exhaustive)}`)
    }
  }
}
