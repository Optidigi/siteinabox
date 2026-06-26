import SmoothImage from "./SmoothImage"

/**
 * Hero block renderer (Preact).
 *
 * Server-rendered on tenant pages (0 KB JS). On the /__preview route,
 * hydrates client-side via PreviewIsland so postMessage updates trigger
 * React reconciliation in <50ms.
 *
 * Props mirror siab-payload/src/blocks/Hero.ts exactly. Optional fields
 * render gracefully — important for live-preview UX where fields fill
 * in mid-edit.
 */
export type HeroProps = {
  eyebrow?: string | null
  headline: string  // required by CMS Block
  subheadline?: string | null
  cta?: {
    label?: string | null
    href?: string | null
  } | null
  // image is resolved to a URL by Blocks.astro before reaching here.
  // Preview-mode resolver points at CMS origin; production at tenant disk.
  imageUrl?: string | null
  imageAlt?: string | null
  dataBlockIndex?: number  // set by PreviewIsland's PreactBlocks; absent in production
}

export default function Hero({
  eyebrow,
  headline,
  subheadline,
  cta,
  imageUrl,
  imageAlt,
  dataBlockIndex,
}: HeroProps) {
  const ctaLabel = cta?.label?.trim()
  const ctaHref = cta?.href?.trim()
  const showCta = ctaLabel && ctaHref

  return (
    <section class="cms-block cms-block--hero py-16 md:py-24" data-block-index={dataBlockIndex}>
      <div class="container mx-auto px-4 grid md:grid-cols-2 gap-8 items-center">
        <div class="space-y-4">
          {eyebrow && (
            <p class="text-sm font-semibold uppercase tracking-wider text-primary">
              {eyebrow}
            </p>
          )}
          <h1 class="text-4xl md:text-5xl font-bold tracking-tight">
            {headline}
          </h1>
          {subheadline && (
            <p class="text-lg text-muted-foreground">{subheadline}</p>
          )}
          {showCta && (
            <a
              href={ctaHref}
              class="inline-block rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {ctaLabel}
            </a>
          )}
        </div>
        {imageUrl && (
          <div class="md:order-last">
            <SmoothImage
              src={imageUrl}
              alt={imageAlt ?? ""}
              class="w-full h-auto rounded-lg shadow-lg"
            />
          </div>
        )}
      </div>
    </section>
  )
}
