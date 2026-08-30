import * as React from "react"
import type { HeroBlock } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../types"
import { HeroBackgroundEffect, HeroInner, HeroMedia, HeroSection, HeroText, resolveBackgroundMode } from "./HeroShared"

export function HeroPatternSplitBlockView({ block, options }: { block: HeroBlock; options: BlockRenderOptions }) {
  const backgroundMode = resolveBackgroundMode(options, block.backgroundMode)
  if (!block.image) throw new Error("hero-05 requires a supplied image")

  return (
    <HeroSection options={options} design="pattern-split" className="relative overflow-hidden bg-background">
      <HeroBackgroundEffect mode={backgroundMode} treatment="patternSplit" />
      <HeroInner overlayContent className="relative grid items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(24rem,1.05fr)] lg:gap-16">
        <HeroText
          block={block}
          options={options}
          backgroundMode={backgroundMode}
          actionStyle="lead"
          className="relative z-40 max-w-[38rem] [&>p]:max-w-[34rem] sm:[&>p]:text-xl sm:[&>p]:leading-9"
          headingClassName="max-w-[16ch] text-[clamp(2.25rem,9vw,3.5rem)] leading-[0.98] sm:text-[clamp(3rem,5.8vw,5.75rem)]"
        />
        <div className="relative">
          <div
            className="siab-hero-offset-plane pointer-events-none absolute inset-0 z-10 translate-x-3 translate-y-3 rounded-[var(--siab-radius-lg)] sm:translate-x-5 sm:translate-y-5"
            aria-hidden="true"
          />
          <HeroMedia
            media={block.image}
            options={options}
            fallbackAlt={block.heading}
            sizes="(min-width: 1024px) 52vw, 100vw"
            className="object-center"
            frameClassName="hero-pattern-split-media relative z-30 bg-background shadow-md"
          />
        </div>
      </HeroInner>
    </HeroSection>
  )
}
