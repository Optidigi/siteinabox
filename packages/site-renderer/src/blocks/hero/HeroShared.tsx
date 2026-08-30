import * as React from "react"
import { DEFAULT_THEME_TOKEN_SPEC, type Action, type AnyHeroBlock, type BackgroundMode, type HeroHighlight, type HeroServiceHighlight, type MediaRef } from "@siteinabox/contracts"
import { buttonVariants } from "@siteinabox/ui/components/button"
import { cn } from "@siteinabox/ui/lib/utils"
import { resolveMedia } from "../../media"
import {
  SiteArrowRight,
  SiteArrowUpRight,
  SiteLayers,
  SiteShieldCheck,
  SiteSpark,
  SiteUser,
  type SiteIconProps,
} from "../../icons/SiteIcons"
import { Section, SectionInner } from "../shared"
import type { BlockRenderOptions, RendererElementPath } from "../types"

type HeroCopyBlock = Pick<AnyHeroBlock, "heading" | "body" | "primaryAction" | "secondaryAction">
type ActionBlock = Pick<HeroCopyBlock, "primaryAction" | "secondaryAction">
type HeroActionStyle = "default" | "lead"

export function resolveBackgroundMode(options: BlockRenderOptions, override?: BackgroundMode | null): BackgroundMode {
  return override ?? options.theme?.appearance?.backgroundMode ?? DEFAULT_THEME_TOKEN_SPEC.appearance.backgroundMode
}

export function HeroSection({
  children,
  options,
  design,
  flush = false,
  className,
}: {
  children: React.ReactNode
  options: BlockRenderOptions
  design: string
  flush?: boolean
  className?: string
}) {
  return (
    <Section
      options={options}
      id={options.sectionAttributes?.id}
      aria-labelledby={`siab-hero-heading-${options.index}`}
      data-siab-hero-design={design}
    className={cn("relative isolate flex", flush ? "items-stretch py-0" : "site-hero-padded items-center", className)}
    >
      {children}
    </Section>
  )
}

function fieldPath(options: BlockRenderOptions, field: string): RendererElementPath {
  return { blockIndex: options.index, field }
}

export function HeroText({
  block,
  options,
  align = "left",
  actionStyle = "default",
  showActionArrows = true,
  beforeActions,
  afterActions,
  className,
  headingClassName,
  overlayContent = false,
  backgroundMode,
}: {
  block: HeroCopyBlock
  options: BlockRenderOptions
  align?: "left" | "center"
  actionStyle?: HeroActionStyle
  showActionArrows?: boolean
  beforeActions?: React.ReactNode
  afterActions?: React.ReactNode
  className?: string
  headingClassName?: string
  overlayContent?: boolean
  backgroundMode?: BackgroundMode | null
}) {
  const heading = options.editSlots?.renderText
    ? options.editSlots.renderText({ name: "heading", value: block.heading, className: "", multiline: true, elementPath: fieldPath(options, "heading") })
    : block.heading
  const body = options.editSlots?.renderText
    ? options.editSlots.renderText({ name: "body", value: block.body, className: "", multiline: true, elementPath: fieldPath(options, "body") })
    : block.body
  const Heading = options.index === 0 ? "h1" : "h2"
  const meshCopyClassName = resolveBackgroundMode(options, backgroundMode) === "mesh"
    ? "hero-mesh-copy-safe"
    : null

  return (
    <div
      data-siab-navbar-overlay-content={overlayContent ? "true" : undefined}
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        meshCopyClassName,
        className,
      )}
    >
      <Heading id={`siab-hero-heading-${options.index}`} className={cn("font-heading text-4xl font-semibold leading-[1.05] tracking-tight text-foreground [text-wrap:balance] sm:text-5xl lg:text-6xl", headingClassName)}>{heading}</Heading>
      <p className={cn("hero-body-copy mt-6 max-w-xl font-medium text-base leading-7 [text-wrap:pretty] sm:text-lg sm:leading-8", align === "center" && "mx-auto")}>{body}</p>
      {beforeActions}
      <HeroActions block={block} options={options} align={align} actionStyle={actionStyle} showArrows={showActionArrows} />
      {afterActions}
    </div>
  )
}

function actionNode(
  action: Action,
  name: string,
  options: BlockRenderOptions,
  className: string,
  showArrow = false,
  elementPathOverride?: RendererElementPath,
) {
  const elementPath = elementPathOverride ?? fieldPath(options, name)
  const actionClassName = cn(
    className,
    "hero-action rounded-[var(--siab-radius-control)]",
    name === "primaryAction" && "hero-primary-action",
    name === "secondaryAction" && "hero-secondary-action",
  )
  if (options.editSlots?.renderCta) {
    return options.editSlots.renderCta({
      name,
      value: action,
      className: actionClassName,
      showArrow,
      elementPath,
    })
  }
  return (
    <a
      href={action.href}
      className={actionClassName}
      {...(action.external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      <span>{action.label}</span>
      {showArrow ? (action.external
        ? <SiteArrowUpRight className="hero-action-arrow" size={16} />
        : <SiteArrowRight className="hero-action-arrow" size={16} />) : null}
    </a>
  )
}

export function HeroActions({
  block,
  options,
  align = "left",
  actionStyle = "default",
  showArrows = true,
  actionElementPath,
}: {
  block: ActionBlock
  options: BlockRenderOptions
  align?: "left" | "center"
  actionStyle?: HeroActionStyle
  showArrows?: boolean
  actionElementPath?: (name: "primaryAction" | "secondaryAction") => RendererElementPath
}) {
  return (
    <div className={cn("flex min-w-0 max-w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center", actionStyle === "lead" ? "mt-8" : "mt-9", align === "center" ? "items-center sm:justify-center" : "items-start")}>
      {actionNode(block.primaryAction, "primaryAction", options, cn(buttonVariants({ variant: "default", size: "lg" }), "min-w-44 max-w-full justify-center whitespace-nowrap"), showArrows, actionElementPath?.("primaryAction"))}
      {block.secondaryAction
        ? actionNode(
          block.secondaryAction,
          "secondaryAction",
          options,
          cn(buttonVariants({ variant: "outline", size: "lg" }), "max-w-full justify-center whitespace-nowrap shadow-none"),
          showArrows && actionStyle === "lead",
          actionElementPath?.("secondaryAction"),
        )
        : null}
    </div>
  )
}

function mediaAlt(media: MediaRef, fallback: string): string {
  if (typeof media === "object" && media !== null && "alt" in media && typeof media.alt === "string" && media.alt.trim()) return media.alt
  return fallback
}

function mediaDimensions(media: MediaRef): { width?: number; height?: number } {
  if (typeof media !== "object" || media === null) return {}
  return {
    ...(typeof media.width === "number" ? { width: media.width } : {}),
    ...(typeof media.height === "number" ? { height: media.height } : {}),
  }
}

export function HeroMedia({
  media,
  options,
  className,
  frameClassName,
  fallbackAlt = "",
  decorative = false,
  loading,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  elementPath,
}: {
  media: MediaRef
  options: BlockRenderOptions
  className?: string
  frameClassName?: string
  fallbackAlt?: string
  decorative?: boolean
  loading?: "eager" | "lazy"
  sizes?: string
  elementPath?: RendererElementPath
}) {
  const resolved = resolveMedia(media, options.mediaResolver)
  const resolvedLoading = loading ?? options.imageLoading ?? (options.index === 0 ? "eager" : "lazy")
  const dimensions = mediaDimensions(media)
  const rendered = options.editSlots?.renderImage
    ? options.editSlots.renderImage({
      name: "image",
      value: media,
      alt: decorative ? "" : mediaAlt(media, fallbackAlt),
      className: cn("block h-full w-full object-cover", className),
      loading: resolvedLoading,
      decoding: "async",
      elementPath: elementPath ?? fieldPath(options, "image"),
    })
    : resolved
      ? <img src={resolved.src} alt={decorative ? "" : resolved.alt ?? mediaAlt(media, fallbackAlt)} className={cn("block h-full w-full object-cover", className)} loading={resolvedLoading} decoding="async" sizes={sizes} {...dimensions} />
      : null

  return <div data-siab-hero-media className={cn("overflow-hidden rounded-[var(--siab-radius-lg)] bg-muted", frameClassName)}>{rendered}</div>
}

export function HeroBackground({
  mode,
  media,
  mediaLayers,
  options,
  fallbackAlt,
  className,
}: {
  mode: BackgroundMode
  media?: MediaRef
  mediaLayers?: readonly (MediaRef | undefined)[]
  options: BlockRenderOptions
  fallbackAlt: string
  className?: string
}) {
  if (mode === "none") return null

  if (mode === "animation") {
    return (
      <div
        data-siab-background-mode="animation"
        data-siab-hero-dither-effect="true"
        className={cn("hero-lead-background-animation pointer-events-none absolute inset-0 z-0 overflow-hidden", className)}
        aria-hidden="true"
      />
    )
  }

  if (mode === "grid") {
    return (
      <div
        data-siab-background-mode="grid"
        className={cn("hero-lead-background-grid pointer-events-none absolute inset-0 z-0 overflow-hidden", className)}
        aria-hidden="true"
      >
        <div className="hero-lead-grid-field absolute inset-0" />
        <div className="hero-lead-grid-veil absolute inset-0" />
      </div>
    )
  }

  if (mode === "ambient") {
    return (
      <div
        data-siab-background-mode="ambient"
        data-siab-hero-ambient-profile="default"
        className={cn("hero-lead-background-ambient pointer-events-none absolute inset-0 z-0 overflow-hidden", className)}
        aria-hidden="true"
      >
        <div className="hero-ambient-field absolute inset-0" data-siab-hero-ambient-effect="true" />
      </div>
    )
  }

  if (mode === "mesh") {
    return (
      <div
        data-siab-background-mode="mesh"
        data-siab-hero-mesh-effect="true"
        className={cn("hero-lead-background-mesh pointer-events-none absolute inset-0 z-0 overflow-hidden", className)}
        aria-hidden="true"
      />
    )
  }

  const hasSelectableMedia = mediaLayers && mediaLayers.length > 0

  return (
    <div data-siab-background-mode="image" className={cn("pointer-events-none absolute inset-0 z-0 overflow-hidden", className)} aria-hidden="true">
      {hasSelectableMedia ? (
        <>
          <div className="hero-lead-media-backdrop absolute inset-0 h-full w-full overflow-hidden">
            <HeroServiceMediaSwitch
              mediaLayers={mediaLayers}
              options={options}
              fallbackAlt={fallbackAlt}
              mediaClassName="hero-lead-media-backdrop-image"
              sizes="100vw"
              className="absolute inset-0"
            />
            <div className="hero-lead-media-glass absolute inset-0" />
            <div className="hero-lead-media-overlay absolute inset-0" />
          </div>
          <div className="hero-lead-media-bleed absolute inset-y-0 left-1/2 z-10 h-full -translate-x-1/2">
            <HeroServiceMediaSwitch
              mediaLayers={mediaLayers}
              options={options}
              fallbackAlt={fallbackAlt}
              sizes="(min-width: 120rem) 120rem, 100vw"
              className="absolute inset-0"
            />
            <div className="hero-lead-media-overlay absolute inset-0" />
          </div>
        </>
      ) : media ? (
        <>
          <div className="hero-lead-media-backdrop absolute inset-0 h-full w-full overflow-hidden">
            <HeroMedia
              media={media}
              options={options}
              sizes="100vw"
              className="hero-lead-media-backdrop-image object-cover"
              frameClassName="absolute inset-0 h-full rounded-none"
              decorative
            />
            <div className="hero-lead-media-glass absolute inset-0" />
            <div className="hero-lead-media-overlay absolute inset-0" />
          </div>
          <div className="hero-lead-media-bleed absolute inset-y-0 left-1/2 z-10 h-full -translate-x-1/2">
            <HeroMedia
              media={media}
              options={options}
              sizes="(min-width: 120rem) 120rem, 100vw"
              className="object-cover"
              frameClassName="absolute inset-0 h-full rounded-none"
              decorative
            />
            <div className="hero-lead-media-overlay absolute inset-0" />
          </div>
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-accent/10" />
          <div className="absolute left-1/2 top-1/2 size-[min(42rem,86vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
        </>
      )}
    </div>
  )
}

/**
 * Additive treatments for split heroes. Unlike HeroBackground, this helper
 * never owns the media: image-led layouts keep their image and opt into one
 * extra, token-driven visual layer only when the toolbar asks for it.
 */
export function HeroBackgroundEffect({
  mode,
  treatment = "angled",
  className,
}: {
  mode: BackgroundMode
  treatment?: "angled" | "framed" | "patternSplit"
  className?: string
}) {
  if (mode === "image" || mode === "none") return null

  const animationClassName = treatment === "framed"
    ? "hero-framed-background-animation"
    : treatment === "patternSplit"
      ? "hero-pattern-split-background-animation"
      : "hero-angled-background-animation"
  const gridClassName = treatment === "framed"
    ? "hero-framed-background-grid"
    : treatment === "patternSplit"
      ? "hero-pattern-split-background-grid"
      : "hero-angled-background-grid"
  const gridFieldClassName = treatment === "framed"
    ? "hero-framed-grid-field"
    : treatment === "patternSplit"
      ? "hero-pattern-split-grid-field"
      : "hero-angled-grid-field"
  const ambientClassName = treatment === "framed"
    ? "hero-framed-background-ambient"
    : treatment === "patternSplit"
      ? "hero-pattern-split-background-ambient"
      : "hero-angled-background-ambient"
  const meshClassName = treatment === "framed"
    ? "hero-framed-background-mesh"
    : treatment === "patternSplit"
      ? "hero-pattern-split-background-mesh"
      : "hero-angled-background-mesh"
  const effectLayerClassName = treatment === "angled" ? "z-20" : "z-0"

  if (mode === "ambient") {
    return (
      <div
        data-siab-background-mode="ambient"
        data-siab-hero-ambient-profile={treatment === "framed" ? "framed" : "default"}
        className={cn(ambientClassName, "pointer-events-none absolute inset-0 overflow-hidden", effectLayerClassName, className)}
        aria-hidden="true"
      >
        <div className="hero-ambient-field absolute inset-0" data-siab-hero-ambient-effect="true" />
      </div>
    )
  }

  if (mode === "mesh") {
    return (
      <div
        data-siab-background-mode="mesh"
        data-siab-hero-mesh-effect="true"
        className={cn(meshClassName, "pointer-events-none absolute inset-0 overflow-hidden", effectLayerClassName, className)}
        aria-hidden="true"
      />
    )
  }

  if (mode === "animation") {
    return (
      <div
        data-siab-background-mode="animation"
        data-siab-hero-dither-effect="true"
        className={cn(animationClassName, "pointer-events-none absolute inset-0 overflow-hidden", effectLayerClassName, className)}
        aria-hidden="true"
      />
    )
  }

  return (
    <div
      data-siab-background-mode="grid"
      className={cn(gridClassName, "pointer-events-none absolute inset-0 overflow-hidden", effectLayerClassName, className)}
      aria-hidden="true"
    >
      <div className={cn(gridFieldClassName, "absolute inset-0")} />
    </div>
  )
}

export function HeroGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <SectionInner className={cn("grid items-center gap-10 lg:grid-cols-2 lg:gap-16", className)}>{children}</SectionInner>
}

export function HeroInner({
  children,
  className,
  overlayContent = false,
}: {
  children: React.ReactNode
  className?: string
  overlayContent?: boolean
}) {
  return (
    <SectionInner
      data-siab-navbar-overlay-content={overlayContent ? "true" : undefined}
      className={className}
    >
      {children}
    </SectionInner>
  )
}

/**
 * Split-hero copy stays aligned to the site's normal grid. The angled hero
 * owns its media geometry separately so its image can fill the complete hero
 * height without changing the copy measure or the shared content frame.
 */
export function HeroEdgeCopy({
  children,
  side = "left",
  className,
}: {
  children: React.ReactNode
  side?: "left" | "right"
  className?: string
}) {
  return (
    <div
      data-siab-navbar-overlay-content="true"
      className={cn(
        "hero-edge-copy flex items-center",
        side === "left"
          ? "lg:pl-[max(2.5rem,calc((100vw_-_var(--siab-content-max))/2_+_2.5rem))] lg:pr-16"
          : "lg:pl-16 lg:pr-[max(2.5rem,calc((100vw_-_var(--siab-content-max))/2_+_2.5rem))]",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function HeroServiceMediaSwitch({
  baseMedia,
  highlights,
  mediaLayers,
  options,
  fallbackAlt,
  className,
  mediaClassName,
  sizes,
}: {
  baseMedia?: MediaRef
  highlights?: readonly HeroServiceHighlight[]
  mediaLayers?: readonly (MediaRef | undefined)[]
  options: BlockRenderOptions
  fallbackAlt: string
  className?: string
  mediaClassName?: string
  sizes?: string
}) {
  const layers = mediaLayers ?? (highlights ?? []).map((highlight) => highlight.image ?? baseMedia)

  return (
    <div className={cn("hero-service-media-switch", className)}>
      {layers.map((layer, index) => layer ? (
        <div
          key={`hero-service-media-${index}`}
          className="hero-service-media-layer absolute inset-0"
          data-siab-hero-service-media-index={index}
          aria-hidden="true"
        >
          <HeroMedia
            media={layer}
            options={options}
            fallbackAlt={`${highlights?.[index]?.title ?? fallbackAlt} — ${fallbackAlt}`}
            className={cn("object-cover", mediaClassName)}
            sizes={sizes}
            decorative
            frameClassName="h-full rounded-none"
            elementPath={{ ...fieldPath(options, "serviceHighlights"), itemIndex: index, subField: "image" }}
          />
        </div>
      ) : null)}
    </div>
  )
}

export function HeroServiceHighlights({
  highlights,
  className,
  radioName,
  icons,
}: {
  highlights: HeroServiceHighlight[]
  className?: string
  radioName: string
  icons?: readonly React.ComponentType<SiteIconProps>[]
}) {
  const iconSet = icons && icons.length > 0 ? icons : [SiteLayers]
  return (
    <fieldset className="m-0 w-full min-w-0 border-0 p-0">
      <legend className="sr-only">Kies een dienst</legend>
      <ul
        className={cn("grid items-stretch grid-cols-1 lg:grid-cols-[repeat(auto-fit,minmax(0,1fr))]", className)}
      >
        {highlights.map((highlight, index) => {
          const optionId = `${radioName}-${index}`
          return (
            <li key={`${highlight.title}-${index}`} className="hero-service-option relative min-w-0">
              <input
                id={optionId}
                type="radio"
                name={radioName}
                defaultChecked={index === 0}
                aria-controls={`${radioName}-copy`}
                className="hero-service-option-input sr-only"
              />
              <label htmlFor={optionId} className="hero-service-option-label block h-full">
                <span className="hero-service-option-surface flex h-full min-w-0 flex-col p-5 sm:p-6 lg:p-7">
                  <span className="flex items-center gap-3">
                    <span className="hero-service-option-icon flex size-9 shrink-0 items-center justify-center rounded-[var(--siab-radius-control)] bg-primary/10 text-primary" aria-hidden="true">
                      {React.createElement(iconSet[index % iconSet.length] ?? SiteLayers, { size: 19 })}
                    </span>
                    <span className="hero-service-option-title font-heading text-base font-semibold leading-6 lg:text-lg">{highlight.title}</span>
                  </span>
                  <span className="hero-service-option-body mt-3 text-sm leading-6">{highlight.body}</span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}

export function HeroValuePoints({
  highlights,
  options,
  className,
  icons,
  iconSize = 28,
  presentation = "cards",
}: {
  highlights: HeroHighlight[]
  options: BlockRenderOptions
  className?: string
  icons?: readonly React.ComponentType<SiteIconProps>[]
  iconSize?: number
  presentation?: "cards" | "proof-cards" | "proof-band"
}) {
  if (highlights.length === 0) return null

  const cardColumns = highlights.length === 2
    ? "md:grid-cols-2"
    : highlights.length === 3
      ? "md:grid-cols-3"
      : "md:grid-cols-2 lg:grid-cols-4"
  const iconSet = icons && icons.length > 0 ? icons : [SiteShieldCheck, SiteSpark, SiteUser]
  const isProofCards = presentation === "proof-cards"
  const isProofBand = presentation === "proof-band"
  const isHeroProof = isProofCards || isProofBand

  return (
    <div
      data-siab-hero-value-points
      data-siab-hero-value-points-presentation={presentation}
      className={cn(
        "hero-value-points w-full",
        isProofBand
          ? "mt-16 border-y border-border/65 bg-card/35 sm:mt-20"
          : isProofCards
            ? "mt-16 sm:mt-20"
          : "mt-16 overflow-hidden rounded-[var(--siab-radius-lg)] border border-border/70 bg-card/85 shadow-sm ring-1 ring-border/20 sm:mt-20",
        className,
      )}
    >
      <ul
        className={cn(
          "grid w-full grid-cols-1",
          isProofBand
            ? "divide-y divide-border/65 md:divide-x md:divide-y-0"
            : isProofCards
              ? "items-stretch gap-4 sm:gap-5 lg:gap-6"
              : "divide-y divide-border/65 md:divide-x md:divide-y-0",
          cardColumns,
        )}
      >
        {highlights.map((highlight, index) => (
          <li
            key={`${highlight.title}-${index}`}
            className={cn(
              "min-w-0",
              isProofBand
                ? "flex min-w-0 items-center gap-4 px-5 py-5 text-left sm:gap-5 sm:py-6 lg:px-8"
                : isProofCards
                  ? "flex h-full flex-col items-center rounded-[var(--siab-radius-lg)] border border-border/70 bg-card/85 p-6 text-center shadow-sm sm:p-7"
                : "flex min-h-28 items-center gap-4 p-5 text-left hero-value-point-card sm:gap-5 sm:p-6",
            )}
          >
            <span
              className={cn(
                "hero-value-point-icon flex shrink-0 items-center justify-center text-primary",
                isProofBand ? "size-10" : isProofCards ? "mb-5" : "size-10",
              )}
              aria-hidden="true"
            >
              {React.createElement(iconSet[index % iconSet.length] ?? SiteShieldCheck, { size: iconSize })}
            </span>
            <span className={cn("min-w-0", isProofCards && "mx-auto max-w-[24rem]")}>
              <strong className={cn("block font-heading font-semibold leading-6", isHeroProof ? "text-base sm:text-lg" : "text-[1.0625rem]")}>
                {options.editSlots?.renderText
                  ? options.editSlots.renderText({ name: "highlights", value: highlight.title, className: "", multiline: true, elementPath: { ...fieldPath(options, "highlights"), itemIndex: index, subField: "title" } })
                  : highlight.title}
              </strong>
              <span className={cn("block text-[0.9375rem] leading-6 text-muted-foreground", isProofCards ? "mt-2" : "mt-1.5")}>
                {options.editSlots?.renderText
                  ? options.editSlots.renderText({ name: "highlights", value: highlight.body, className: "", multiline: true, elementPath: { ...fieldPath(options, "highlights"), itemIndex: index, subField: "body" } })
                  : highlight.body}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
