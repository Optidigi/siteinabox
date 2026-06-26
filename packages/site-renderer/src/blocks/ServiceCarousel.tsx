import * as React from "react"
import type { ServiceCarouselBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function ServiceCarouselBlockRenderer({
  block,
  options,
}: {
  block: ServiceCarouselBlock
  options: BlockRenderOptions
}) {
  if (!block.items.length) return null
  const carousel = block.carousel
  const layout = block.layout ?? "carousel"
  const slidesDesktop = carousel?.slidesPerView ?? 3
  const slidesTablet = carousel?.slidesPerViewTablet ?? 2
  const slidesMobile = carousel?.slidesPerViewMobile ?? 1
  const spacing = carousel?.spaceBetween ?? 24
  const sourceVariant = rendererVariantClassName(block)

  return (
    <section
      id={block.anchor || undefined}
      className={`cms-block cms-block--serviceCarousel cms-block--serviceCarousel-${layout} ${sourceVariant}`.trim()}
      data-source-variant={runtimeVariantDataAttribute(block)}
      data-block-index={options.index}
      data-autoplay={carousel?.autoplay ? "true" : undefined}
      data-autoplay-delay={carousel?.autoplayDelayMs ?? undefined}
      data-loop={carousel?.loop ? "true" : undefined}
      data-pause-on-interaction={carousel?.pauseOnInteraction ? "true" : undefined}
      data-siab-service-carousel={layout === "carousel" ? "true" : undefined}
      style={{
        "--service-slides-desktop": slidesDesktop,
        "--service-slides-tablet": slidesTablet,
        "--service-slides-mobile": slidesMobile,
        "--service-slide-gap": `${spacing}px`,
      } as React.CSSProperties}
      {...sectionAnalyticsAttrs(block.analytics, "serviceCarousel", options.index)}
    >
      {block.title && (
        <h2 className="cms-block__title" style={{ fontFamily: "var(--font-heading)" }}>
          <RichTextRenderer value={block.title} />
        </h2>
      )}
      {block.intro && (
        <div className="cms-block__intro" style={{ fontFamily: "var(--font-text)" }}>
          <RichTextRenderer value={block.intro} />
        </div>
      )}
      <div className="cms-block__serviceTrack" data-pagination={carousel?.pagination ?? "none"} data-siab-service-track="true">
        {block.items.map((item, i) => {
          const image = resolveMedia(item.image ?? null, options.mediaResolver)
          return (
            <article key={i} className="cms-block__serviceCard">
              {image && (
                <img className="cms-block__serviceImage" src={image.src} alt={image.alt ?? ""} loading="lazy" decoding="async" />
              )}
              <div className="cms-block__serviceBody">
                <h3 className="cms-block__serviceTitle" style={{ fontFamily: "var(--font-heading)" }}>
                  <RichTextRenderer value={item.title} blockMode="inline" />
                </h3>
                {item.description && (
                  <div className="cms-block__serviceDescription" style={{ fontFamily: "var(--font-text)" }}>
                    <RichTextRenderer value={item.description} />
                  </div>
                )}
                {item.cta?.href && item.cta.label && (
                  <a className="cms-block__serviceCta" href={item.cta.href} {...actionAnalyticsAttrs("inline", item.cta.label)}>
                    {item.cta.label}
                  </a>
                )}
              </div>
            </article>
          )
        })}
      </div>
      {layout === "carousel" && carousel?.pagination && carousel.pagination !== "none" && (
        <div className="cms-block__servicePagination" aria-hidden="true">
          {carousel.pagination === "fraction" ? (
            <span>1 / {block.items.length}</span>
          ) : (
            block.items.map((_, i) => <span key={i} className={i === 0 ? "is-active" : undefined} />)
          )}
        </div>
      )}
    </section>
  )
}
