import * as React from "react"
import type { HeroBlock } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../types"
import { HeroBackgroundEffect, HeroEdgeCopy, HeroMedia, HeroSection, HeroText, HeroValuePoints, resolveBackgroundMode } from "./HeroShared"
import { SectionInner } from "../shared"

export function HeroAngledBlockView({ block, options }: { block: HeroBlock; options: BlockRenderOptions }) {
  const backgroundMode = resolveBackgroundMode(options, block.backgroundMode)
  if (!block.image) throw new Error("hero-03 requires a supplied image")

  return (
    <HeroSection options={options} design="angled" flush className="overflow-x-clip overflow-y-visible bg-background">
      <HeroBackgroundEffect mode={backgroundMode} />
      <SectionInner className="relative grid min-h-0 w-full items-stretch px-0 sm:px-0 lg:grid-cols-2 lg:px-0">
        <HeroEdgeCopy className="relative z-40 min-h-full lg:pl-10 lg:pr-[clamp(2rem,2.5vw,3rem)]">
          <HeroText
            block={block}
            options={options}
            backgroundMode={backgroundMode}
            actionStyle="lead"
            className="relative z-30 w-full min-w-0 max-w-[40rem] [&>p]:max-w-[36rem] lg:[&>p]:text-xl lg:[&>p]:leading-9 [&_.hero-primary-action]:bg-primary [&_.hero-primary-action]:text-primary-foreground [&_.hero-primary-action]:hover:bg-primary/75"
            headingClassName="text-4xl leading-[1.08] sm:text-5xl sm:leading-[1.1] lg:text-6xl lg:leading-[1.08]"
            afterActions={block.highlights ? <HeroValuePoints highlights={block.highlights} options={options} className="mt-8" /> : null}
          />
        </HeroEdgeCopy>
        <div className="hero-angled-media-slot relative min-h-0 min-w-0 lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
          <HeroMedia
            media={block.image}
            options={options}
            fallbackAlt={block.heading}
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="min-h-full object-cover object-center"
            frameClassName="hero-angled-media-frame relative z-30 h-auto w-full aspect-[4/3] rounded-none bg-background sm:aspect-[3/2] lg:aspect-auto lg:h-full lg:min-h-0"
          />
          <div
            className="hero-angled-edge-left pointer-events-none absolute -bottom-px left-0 top-0 z-10 hidden w-[clamp(5rem,7vw,6rem)] bg-background lg:block [clip-path:polygon(-1px_0,52%_0,100%_100%,100%_calc(100%+2px),-1px_calc(100%+2px))]"
            aria-hidden="true"
          />
          <div
            className="hero-angled-edge-right pointer-events-none absolute -bottom-px right-0 top-0 z-10 hidden w-[clamp(5rem,7vw,6rem)] bg-background lg:block [clip-path:polygon(calc(100%+1px)_0,0_0,48%_100%,48%_calc(100%+2px),calc(100%+1px)_calc(100%+2px))]"
            aria-hidden="true"
          />
        </div>
      </SectionInner>
    </HeroSection>
  )
}
