import * as React from "react"
import type { Action, CtaBlock } from "@siteinabox/contracts"
import { buttonVariants } from "@siteinabox/ui/components/button"
import { cn } from "@siteinabox/ui/lib/utils"
import { HeroActions, HeroBackground, resolveBackgroundMode } from "../hero/HeroShared"
import { Section, SectionInner, assertNever } from "../shared"
import type { BlockRenderOptions } from "../types"

function fieldPath(options: BlockRenderOptions, field: string) {
  return { blockIndex: options.index, field }
}

function Cta01Block({ block, options }: { block: CtaBlock; options: BlockRenderOptions }) {
  const backgroundMode = resolveBackgroundMode(options, block.backgroundMode)
  const hasImageBackground = backgroundMode === "image" && Boolean(block.image)
  const headingId = `siab-cta-heading-${options.index}`
  const bodyId = block.body ? `siab-cta-body-${options.index}` : undefined
  const heading = options.editSlots?.renderText
    ? options.editSlots.renderText({
      name: "heading",
      value: block.heading,
      className: "",
      multiline: true,
      elementPath: fieldPath(options, "heading"),
    })
    : block.heading
  const body = options.editSlots?.renderText
    ? options.editSlots.renderText({
      name: "body",
      value: block.body,
      className: "",
      multiline: true,
      elementPath: fieldPath(options, "body"),
    })
    : block.body

  return (
    <Section
      options={options}
      id={options.sectionAttributes?.id}
      aria-labelledby={headingId}
      {...(bodyId ? { "aria-describedby": bodyId } : {})}
      data-siab-cta-design="cta-01"
      className="site-cta site-cta-01 relative"
    >
      <SectionInner className="site-cta-01-inner">
        <div className="site-cta-01-panel relative isolate overflow-hidden" data-siab-effect-hover-target="true">
          {backgroundMode === "image" && !block.image ? (
            <div
              data-siab-background-mode="image"
              className="site-cta-01-background pointer-events-none absolute inset-0 z-0 bg-background"
              aria-hidden="true"
            />
          ) : (
            <HeroBackground
              mode={backgroundMode}
              media={block.image}
              options={options}
              fallbackAlt={block.heading}
              className="site-cta-01-background"
            />
          )}
          <div
            className={cn(
              "site-cta-01-copy relative z-20 mx-auto flex w-full flex-col items-center text-center",
              backgroundMode === "mesh" && "hero-mesh-copy-safe",
              hasImageBackground && "hero-on-media-actions text-[var(--on-media)] [&_h2]:text-[var(--on-media)]",
            )}
          >
            <h2 id={headingId} className="site-cta-01-title font-heading text-foreground [text-wrap:balance]">{heading}</h2>
            {block.body ? <p id={bodyId} className="site-cta-01-body hero-body-copy">{body}</p> : null}
            <div className="site-cta-01-actions">
              <HeroActions block={block} options={options} align="center" actionStyle="lead" />
            </div>
          </div>
        </div>
      </SectionInner>
    </Section>
  )
}

function Cta02Action({
  action,
  name,
  options,
}: {
  action: Action
  name: "primaryAction" | "secondaryAction"
  options: BlockRenderOptions
}) {
  const primary = name === "primaryAction"
  const className = primary
    ? cn(
      buttonVariants({ variant: "default", size: "lg" }),
      "hero-action hero-primary-action site-cta-02-primary max-w-full whitespace-nowrap",
    )
    : "site-cta-02-more-link"
  const showArrow = !primary

  if (options.editSlots?.renderCta) {
    return options.editSlots.renderCta({
      name,
      value: action,
      className,
      showArrow,
      elementPath: fieldPath(options, name),
    })
  }

  return (
    <a
      href={action.href}
      className={className}
      {...(action.external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      <span>{action.label}</span>
      {showArrow ? <span className="site-cta-02-more-arrow" aria-hidden="true">→</span> : null}
    </a>
  )
}

function Cta02Block({ block, options }: { block: CtaBlock; options: BlockRenderOptions }) {
  const backgroundMode = resolveBackgroundMode(options, block.backgroundMode)
  const hasImageBackground = backgroundMode === "image" && Boolean(block.image)
  const headingId = `siab-cta-heading-${options.index}`
  const bodyId = block.body ? `siab-cta-body-${options.index}` : undefined
  const heading = options.editSlots?.renderText
    ? options.editSlots.renderText({
      name: "heading",
      value: block.heading,
      className: "",
      multiline: true,
      elementPath: fieldPath(options, "heading"),
    })
    : block.heading
  const body = options.editSlots?.renderText
    ? options.editSlots.renderText({
      name: "body",
      value: block.body,
      className: "",
      multiline: true,
      elementPath: fieldPath(options, "body"),
    })
    : block.body

  return (
    <Section
      options={options}
      id={options.sectionAttributes?.id}
      aria-labelledby={headingId}
      {...(bodyId ? { "aria-describedby": bodyId } : {})}
      data-siab-cta-design="cta-02"
      data-siab-effect-hover-target="true"
      className="site-cta site-cta-02 relative isolate overflow-hidden"
    >
      {backgroundMode === "image" && !block.image ? (
        <div
          data-siab-background-mode="image"
          className="site-cta-02-background pointer-events-none absolute inset-0 z-0 bg-background"
          aria-hidden="true"
        />
      ) : (
        <HeroBackground
          mode={backgroundMode}
          media={block.image}
          options={options}
          fallbackAlt={block.heading}
          className="site-cta-02-background"
        />
      )}
      <SectionInner className="site-cta-02-inner">
        <div
          className={cn(
            "site-cta-02-copy relative z-10 mx-auto w-full text-center",
            backgroundMode === "mesh" && "hero-mesh-copy-safe",
            hasImageBackground && "hero-on-media-actions text-[var(--on-media)] [&_h2]:text-[var(--on-media)]",
          )}
        >
          <h2 id={headingId} className="site-cta-02-title font-heading text-foreground">{heading}</h2>
          {block.body ? <p id={bodyId} className="site-cta-02-body hero-body-copy">{body}</p> : null}
          <div className="site-cta-02-actions">
            <Cta02Action action={block.primaryAction} name="primaryAction" options={options} />
            {block.secondaryAction ? <Cta02Action action={block.secondaryAction} name="secondaryAction" options={options} /> : null}
          </div>
        </div>
      </SectionInner>
    </Section>
  )
}

export function CtaBlockView({ block, options }: { block: CtaBlock; options: BlockRenderOptions }) {
  switch (block.variant) {
    case "cta-01":
      return <Cta01Block block={block} options={options} />
    case "cta-02":
      return <Cta02Block block={block} options={options} />
    default:
      return assertNever(block.variant)
  }
}
