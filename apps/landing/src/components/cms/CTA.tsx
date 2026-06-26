/**
 * CTA block renderer (Preact).
 *
 * Props mirror siab-payload/src/blocks/CTA.ts:
 *  - headline: required text
 *  - description: optional textarea
 *  - primary: group { label*, href* }
 *  - secondary: group { label, href }
 */
export type CTAProps = {
  headline: string  // required
  description?: string | null
  primary?: {
    label?: string | null
    href?: string | null
  } | null
  secondary?: {
    label?: string | null
    href?: string | null
  } | null
  dataBlockIndex?: number  // set by PreviewIsland's PreactBlocks; absent in production
}

export default function CTA({
  headline,
  description,
  primary,
  secondary,
  dataBlockIndex,
}: CTAProps) {
  const primaryLabel = primary?.label?.trim()
  const primaryHref = primary?.href?.trim()
  const showPrimary = primaryLabel && primaryHref

  const secondaryLabel = secondary?.label?.trim()
  const secondaryHref = secondary?.href?.trim()
  const showSecondary = secondaryLabel && secondaryHref

  return (
    <section class="cms-block cms-block--cta py-16 md:py-20" data-block-index={dataBlockIndex}>
      <div class="container mx-auto px-4 text-center max-w-3xl">
        <h2 class="text-3xl md:text-4xl font-bold tracking-tight">
          {headline}
        </h2>
        {description && (
          <p class="mt-4 text-lg text-muted-foreground">{description}</p>
        )}
        {(showPrimary || showSecondary) && (
          <div class="mt-8 flex flex-wrap justify-center gap-3">
            {showPrimary && (
              <a
                href={primaryHref}
                class="inline-block rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {primaryLabel}
              </a>
            )}
            {showSecondary && (
              <a
                href={secondaryHref}
                class="inline-block rounded-md border border-border bg-background px-6 py-3 font-medium hover:bg-accent transition-colors"
              >
                {secondaryLabel}
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
