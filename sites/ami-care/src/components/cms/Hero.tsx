import { MapPin } from "lucide-preact"
import RtNodeRenderer, { extractText } from "./RtNodeRenderer"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "./analytics"
import { isRtRoot } from "../../lib/richText"
import type { AnalyticsBlockMetadata, RtField } from "../../lib/types"

/**
 * Hero block renderer (Preact, Zen-skinned for amicare-zorg).
 *
 * Editorial fields are RtRoot (v2):
 *   - eyebrow:    inline rich (typically just text; Caveat script kicker)
 *   - headline:   inline rich. `<em>...</em>` (italic mark) gets the
 *                 accent-italic + curved-underline treatment via CSS on
 *                 the first `.rt-i` descendant of the headline.
 *   - subheadline: block rich. Lead paragraph below the headline.
 *
 * Hardcoded design elements (pills, floating cards, decorative blobs)
 * are unchanged from the v1 design.
 */
export type HeroProps = {
  eyebrow?: RtField
  headline: RtField
  subheadline?: RtField
  cta?: { label?: string | null; href?: string | null } | null
  imageUrl?: string | null
  imageAlt?: string | null
  pills?: Array<{ label: string }> | null
  anchor?: string | null
  dataBlockIndex?: number
  analytics?: AnalyticsBlockMetadata | null
}

const PULL_QUOTE = "Écht verschil maken voor jongeren en gezinnen."

export default function Hero({
  eyebrow,
  headline,
  subheadline,
  cta,
  imageUrl,
  imageAlt,
  pills,
  anchor,
  dataBlockIndex,
  analytics,
}: HeroProps) {
  const ctaLabel = cta?.label?.trim()
  const ctaHref = cta?.href?.trim()
  const showCta = ctaLabel && ctaHref

  // Eyebrow may be RtRoot or plain string; extract a single text for the
  // script-font kicker (no marks expected, but we tolerate them).
  const eyebrowText = extractText(eyebrow)

  // Headline: render via RtNodeRenderer inline. The headline-em-underline
  // CSS rule (cms-block--hero h1 .rt-i:first-of-type::after) decorates the
  // first italic-marked span — matching the v1 SVG underline treatment.
  const headlineNode = isRtRoot(headline) ? headline : null

  return (
    <section
      id={anchor || "top"}
      class="cms-block cms-block--hero relative flex min-h-[90vh] flex-col items-center overflow-hidden px-6 py-12 @min-[48rem]/site-frame:flex-row @min-[48rem]/site-frame:px-12 @min-[64rem]/site-frame:px-24"
      data-block-index={dataBlockIndex}
      {...sectionAnalyticsAttrs(analytics, "hero", dataBlockIndex)}
    >
      <div
        aria-hidden="true"
        class="pointer-events-none absolute -left-[10%] -top-[10%] -z-10 h-[500px] w-[500px] rounded-full bg-accent/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        class="pointer-events-none absolute -bottom-[10%] -right-[5%] -z-10 h-[400px] w-[400px] rounded-full bg-accent/10 blur-3xl"
      />

      <div class="relative z-10 w-full space-y-7 @min-[48rem]/site-frame:w-1/2">
        {eyebrowText && (
          <span
            class="inline-block -rotate-2 text-[22px] text-accent animate-fade-up [animation-delay:0ms]"
            style={{ fontFamily: "var(--font-script)" }}
          >
            {eyebrowText}
          </span>
        )}

        <h1
          class="font-serif text-[44px] font-normal leading-[1.05] tracking-[-0.01em] @min-[48rem]/site-frame:text-[60px] @min-[64rem]/site-frame:text-[76px] animate-fade-up [animation-delay:50ms] [overflow-wrap:anywhere] [&_em]:relative [&_em]:not-italic [&_em]:inline-block [&_em]:whitespace-nowrap [&_em]:italic [&_em]:text-accent"
          style={{ maxWidth: "14ch", fontFamily: "var(--font-title)" }}
        >
          {headlineNode && <RtNodeRenderer node={headlineNode} />}
        </h1>

        {subheadline && (
          <p
            class="max-w-md text-[17px] leading-[1.6] text-ink-muted @min-[48rem]/site-frame:text-[18px] animate-fade-up [animation-delay:150ms]"
            style={{ fontFamily: "var(--font-text)" }}
          >
            <RtNodeRenderer node={subheadline} />
          </p>
        )}

        {pills && pills.length > 0 && (
          <div class="flex flex-wrap gap-2 pt-2 animate-fade [animation-delay:300ms]">
            {pills.map((p, i) => (
              <span
                key={i}
                class="rounded-md border border-rule bg-secondary/40 px-3 py-1.5 text-[12px] font-medium text-ink-muted"
                style={{ fontFamily: "var(--font-text)" }}
              >
                {p.label}
              </span>
            ))}
          </div>
        )}

        {showCta && (
          <a
            href={ctaHref}
            class="inline-block rounded-md bg-accent px-6 py-3 text-[14px] font-medium text-bg shadow-sm transition-colors hover:bg-accent/90 animate-fade-up [animation-delay:400ms]"
            style={{ fontFamily: "var(--font-text)" }}
            {...actionAnalyticsAttrs("primary", ctaLabel)}
          >
            {ctaLabel}
          </a>
        )}
      </div>

      <div class="relative mt-14 w-full @min-[48rem]/site-frame:mt-0 @min-[48rem]/site-frame:w-1/2">
        {imageUrl && (
          <div class="relative z-10 animate-fade [animation-delay:100ms]">
            <img
              src={imageUrl}
              alt={imageAlt ?? ""}
              loading="eager"
              decoding="async"
              class="aspect-[4/5] w-full rotate-0 transform rounded-[var(--radius-lg)] object-cover shadow-2xl @min-[48rem]/site-frame:aspect-[4/3] @min-[48rem]/site-frame:rotate-3"
            />

            <figure class="absolute -bottom-8 -left-2 max-w-[230px] rounded-lg border border-rule bg-card p-4 shadow-lg @min-[48rem]/site-frame:-bottom-10 @min-[48rem]/site-frame:-left-8 @min-[48rem]/site-frame:p-5 animate-float [animation-delay:0ms]">
              <span
                aria-hidden="true"
                class="mr-1 align-top text-3xl leading-none italic text-accent"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                &ldquo;
              </span>
              <blockquote class="inline font-serif text-[17px] italic leading-[1.35] text-ink @min-[48rem]/site-frame:text-[19px]">
                {PULL_QUOTE}
              </blockquote>
            </figure>

            <div class="absolute -top-6 -right-2 flex max-w-[200px] items-center gap-3 rounded-lg border border-rule bg-card p-3 shadow-lg @min-[48rem]/site-frame:-top-8 @min-[48rem]/site-frame:-right-8 @min-[48rem]/site-frame:p-4 animate-float [animation-delay:500ms]">
              <span class="rounded-full bg-accent/10 p-2 text-accent">
                <MapPin size={18} />
              </span>
              <div class="text-[12px] leading-tight">
                <p class="font-serif text-[14px] italic text-ink">Roermond e.o.</p>
                <p class="text-ink-muted">Limburg-Noord</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
