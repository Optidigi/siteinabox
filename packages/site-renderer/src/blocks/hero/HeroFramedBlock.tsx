import * as React from "react"
import type { HeroBlock } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../types"
import { HeroBackgroundEffect, HeroInner, HeroMedia, HeroSection, HeroText, resolveBackgroundMode } from "./HeroShared"

export function HeroFramedBlockView({ block, options }: { block: HeroBlock; options: BlockRenderOptions }) {
  const backgroundMode = resolveBackgroundMode(options, block.backgroundMode)
  if (!block.image) throw new Error("hero-04 requires a supplied image")

  return (
    <HeroSection options={options} design="framed" className="items-start bg-card">
      <HeroBackgroundEffect mode={backgroundMode} treatment="framed" />
      <HeroInner overlayContent className="relative w-full">
        <HeroText
          block={block}
          options={options}
          backgroundMode={backgroundMode}
          align="center"
          actionStyle="lead"
          className="relative z-40 mx-auto max-w-[48rem] [&>p]:mx-auto [&>p]:max-w-[40rem] sm:[&>p]:text-xl sm:[&>p]:leading-9"
          headingClassName="mx-auto max-w-[48rem] text-[clamp(2.25rem,9vw,3.5rem)] leading-[1.04] sm:text-6xl lg:text-7xl"
        />
        <div className="relative mt-12 sm:mt-16 lg:mt-20">
          <div
            className="siab-hero-offset-plane pointer-events-none absolute inset-0 z-10 translate-x-3 translate-y-3 rounded-[var(--siab-radius-lg)] sm:translate-x-5 sm:translate-y-5"
            aria-hidden="true"
          />
          <HeroMedia
            media={block.image}
            options={options}
            fallbackAlt={block.heading}
            sizes="(min-width: 1024px) 80vw, 100vw"
            className="object-center"
            frameClassName="relative z-30 aspect-[4/3] bg-background shadow-md sm:aspect-[3/2] lg:aspect-[3/2]"
          />
        </div>
      </HeroInner>
    </HeroSection>
  )
}
