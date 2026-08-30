import * as React from "react"
import type { Action, HeroBlock, HeroServiceHighlight } from "@siteinabox/contracts"
import { cn } from "@siteinabox/ui/lib/utils"
import type { BlockRenderOptions } from "../types"
import { SiteBriefcase, SiteBuilding, SiteHouse, SiteWrench } from "../../icons/SiteIcons"
import { HeroActions, HeroBackground, HeroSection, HeroServiceHighlights, resolveBackgroundMode } from "./HeroShared"
import { SectionInner } from "../shared"
import type { RendererElementPath } from "../types"

type SelectedServiceCopy = {
  heading: string
  body: string
  primaryAction: Action
  secondaryAction?: Action | null
}

function selectedServiceCopy(block: HeroBlock, highlight: HeroServiceHighlight): SelectedServiceCopy {
  return {
    heading: highlight.heroHeading ?? block.heading,
    body: highlight.heroBody ?? block.body,
    primaryAction: highlight.primaryAction ?? block.primaryAction,
    secondaryAction: highlight.secondaryAction === undefined ? block.secondaryAction : highlight.secondaryAction,
  }
}

function serviceFieldPath(options: BlockRenderOptions, index: number, subField: string): RendererElementPath {
  return { blockIndex: options.index, field: "serviceHighlights", itemIndex: index, subField }
}

function renderServiceText(options: BlockRenderOptions, value: string, index: number, subField: "heroHeading" | "heroBody") {
  return options.editSlots?.renderText
    ? options.editSlots.renderText({ name: "serviceHighlights", value, className: "", multiline: true, elementPath: serviceFieldPath(options, index, subField) })
    : value
}

function HeroServicePanelCopy({ block, options, highlights, backgroundMode, radioName }: {
  block: HeroBlock
  options: BlockRenderOptions
  highlights: HeroServiceHighlight[]
  backgroundMode: ReturnType<typeof resolveBackgroundMode>
  radioName: string
}) {
  const Heading = options.index === 0 ? "h1" : "h2"
  return (
    <div
      id={`${radioName}-copy`}
      data-siab-navbar-overlay-content="true"
      className={cn(
        "hero-service-panel-copy mx-auto w-full max-w-6xl text-center [&>p]:max-w-3xl [&>p]:text-base [&>p]:leading-7 [&_a.hero-primary-action]:min-w-[12.3125rem] [&_a.hero-primary-action]:text-base [&_a.hero-primary-action]:font-bold [&_a.hero-primary-action]:text-primary-foreground sm:[&>p]:text-xl sm:[&>p]:leading-9",
        backgroundMode === "image" && "hero-on-media-actions text-[var(--on-media)] [&_h1]:text-[var(--on-media)] [&_h2]:text-[var(--on-media)]",
        backgroundMode === "mesh" && "hero-mesh-copy-safe",
      )}
    >
      <Heading id={`siab-hero-heading-${options.index}`} className="mx-auto max-w-[18ch] font-heading text-[clamp(2.25rem,6vw,3.75rem)] font-semibold leading-[0.98] tracking-tight text-foreground [text-wrap:balance] sm:text-[clamp(3rem,6vw,6rem)] sm:leading-[0.94]">
        {highlights.map((highlight, index) => {
          const copy = selectedServiceCopy(block, highlight)
          return (
            <span key={`${radioName}-heading-${index}`} className="hero-service-copy-heading-panel" data-siab-hero-service-copy-index={index}>
              {renderServiceText(options, copy.heading, index, "heroHeading")}
            </span>
          )
        })}
      </Heading>
      {highlights.map((highlight, index) => {
        const copy = selectedServiceCopy(block, highlight)
        return (
          <p key={`${radioName}-body-${index}`} className="hero-body-copy hero-service-copy-body-panel mx-auto mt-6 max-w-3xl font-medium text-base leading-7 [text-wrap:pretty] sm:text-lg sm:leading-8" data-siab-hero-service-copy-index={index}>
            {renderServiceText(options, copy.body, index, "heroBody")}
          </p>
        )
      })}
      {highlights.map((highlight, index) => {
        const copy = selectedServiceCopy(block, highlight)
        const copyBlock = { ...block, heading: copy.heading, body: copy.body, primaryAction: copy.primaryAction, secondaryAction: copy.secondaryAction }
        return (
          <div key={`${radioName}-actions-${index}`} className="hero-service-copy-actions-panel" data-siab-hero-service-copy-index={index}>
            <HeroActions
              block={copyBlock}
              options={options}
              align="center"
              actionStyle="lead"
              actionElementPath={(name) => serviceFieldPath(options, index, name)}
            />
          </div>
        )
      })}
    </div>
  )
}

export function HeroServicePanelBlockView({ block, options }: { block: HeroBlock; options: BlockRenderOptions }) {
  const backgroundMode = resolveBackgroundMode(options, block.backgroundMode)
  const radioName = `hero-service-panel-${options.index}`
  if (!block.serviceHighlights || block.serviceHighlights.length < 2) {
    throw new Error("hero-02 requires two to four service highlights")
  }
  const serviceMediaLayers = block.serviceHighlights.map((highlight) => highlight.image ?? block.image)

  return (
    <HeroSection options={options} design="service-panel" flush className="relative flex-col items-stretch justify-start overflow-hidden bg-background">
      <div className="hero-service-composition flex w-full flex-col items-stretch">
        <div className="hero-service-panel-stage relative flex w-full items-center overflow-hidden">
          <HeroBackground
            mode={backgroundMode}
            media={block.image}
            mediaLayers={serviceMediaLayers}
            options={options}
            fallbackAlt={block.heading}
            className="hero-service-background"
          />
          <SectionInner className="relative z-30 w-full">
            <HeroServicePanelCopy
              block={block}
              options={options}
              highlights={block.serviceHighlights}
              backgroundMode={backgroundMode}
              radioName={radioName}
            />
          </SectionInner>
        </div>
        <div className="hero-service-panel-rail relative z-10 w-full shrink-0">
          <SectionInner className="w-full pb-8 sm:pb-12 lg:pb-16">
            <HeroServiceHighlights
              highlights={block.serviceHighlights}
              radioName={radioName}
              icons={[SiteHouse, SiteBriefcase, SiteBuilding, SiteWrench]}
              className="hero-service-rail overflow-hidden rounded-[var(--siab-radius-lg)] bg-card text-card-foreground shadow-xl"
            />
          </SectionInner>
        </div>
      </div>
    </HeroSection>
  )
}
