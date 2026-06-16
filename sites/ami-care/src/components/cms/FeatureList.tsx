import { resolveIcon } from "./icons"
import RtNodeRenderer, { extractText } from "./RtNodeRenderer"
import { sectionAnalyticsAttrs } from "./analytics"
import type { AnalyticsBlockMetadata, RtField } from "../../lib/types"

/**
 * FeatureList block renderer (Preact, Zen-skinned for amicare-zorg).
 *
 * Editorial fields use RtRoot (v2):
 *   - title: inline rich; `<em>` (italic mark) gets accent-italic treatment
 *   - intro: block rich; the script-style kicker above the H2
 *   - features[].title: inline rich (Fraunces serif H3)
 *   - features[].description: block rich (body paragraph)
 *   - features[].icon: plain string (lucide-preact icon name, kebab-case)
 */
export type FeatureListProps = {
  title?: RtField
  intro?: RtField
  features: Array<{
    title: RtField
    description?: RtField
    icon?: string | null
  }>
  anchor?: string | null
  dataBlockIndex?: number
  analytics?: AnalyticsBlockMetadata | null
}

export default function FeatureList({
  title,
  intro,
  features,
  anchor,
  dataBlockIndex,
  analytics,
}: FeatureListProps) {
  if (!features || features.length === 0) return null
  // Intro is shown as a single-line script-font kicker — flatten any
  // formatting in the RtRoot to plain text for the legacy visual.
  const introText = extractText(intro)
  return (
    <section
      id={anchor || "werkwijze"}
      class="cms-block cms-block--featurelist relative bg-card/50 px-6 py-20 @min-[48rem]/site-frame:px-12 @min-[48rem]/site-frame:py-24 @min-[64rem]/site-frame:px-24"
      data-block-index={dataBlockIndex}
      {...sectionAnalyticsAttrs(analytics, "featureList", dataBlockIndex)}
    >
      <div class="mx-auto max-w-7xl">
        {(title || introText) && (
          <div class="mb-14 space-y-3 text-center">
            {introText && (
              <span
                class="inline-block -rotate-2 text-[20px] text-accent"
                style={{ fontFamily: "var(--font-script)" }}
              >
                {introText}
              </span>
            )}
            {title && (
              <h2
                class="font-serif text-[34px] leading-[1.1] tracking-[-0.01em] @min-[48rem]/site-frame:text-[44px] [&_em]:not-italic [&_em]:italic [&_em]:text-accent"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                <RtNodeRenderer node={title} />
              </h2>
            )}
          </div>
        )}

        <div class="grid grid-cols-1 gap-8 @min-[48rem]/site-frame:grid-cols-3">
          {features.map((feature, i) => {
            const Icon = resolveIcon(feature.icon)
            return (
              <article
                key={i}
                class="overflow-hidden rounded-lg border border-rule bg-card shadow-lg"
              >
                <div class="flex h-32 items-center justify-center bg-accent/[0.08]">
                  {Icon && <Icon size={44} class="text-accent" strokeWidth={1.5} />}
                </div>
                <div class="space-y-3 p-7 text-center">
                  <h3
                    class="font-serif text-[24px] leading-[1.2]"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    <RtNodeRenderer node={feature.title} />
                  </h3>
                  {feature.description && (
                    <p
                      class="text-[16px] leading-[1.6] text-ink-muted"
                      style={{ fontFamily: "var(--font-text)" }}
                    >
                      <RtNodeRenderer node={feature.description} />
                    </p>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
