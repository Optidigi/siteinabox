import RtNodeRenderer, { extractText } from "./RtNodeRenderer"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "./analytics"
import type { AnalyticsBlockMetadata, MediaRef, RtField } from "../../lib/types"

/**
 * CTA block renderer (Preact, Zen-skinned for amicare-zorg).
 *
 * Variant dispatch on primary.href:
 *   - mailto:/tel: → contact-style (big underlined email link)
 *   - else → quote-style (italic Fraunces big-quote with bedroom backdrop)
 *
 * Editorial fields:
 *   - eyebrow: inline rich (RtRoot)
 *   - headline: inline rich (RtRoot)
 *   - description: block rich (RtRoot)
 *   - primary.label / primary.href: plain string
 *   - secondary.label / secondary.href: plain string
 *   - backgroundImage: optional decorative media object
 *
 * Quote-style headline used to be wrapped in literal &ldquo;/&rdquo;
 * curly quotes around the JSX `{headline}` interpolation. The new
 * RtNodeRenderer emits its own elements; the curly quotes wrap the
 * rendered output the same way (as plain text siblings).
 */
export type CTAProps = {
  eyebrow?: RtField
  headline?: RtField | null
  description?: RtField
  primary?: { label?: string | null; href?: string | null } | null
  secondary?: { label?: string | null; href?: string | null } | null
  backgroundImage?: MediaRef
  anchor?: string | null
  dataBlockIndex?: number
  analytics?: AnalyticsBlockMetadata | null
}

const mediaUrl = (value: MediaRef | undefined): string | null => {
  if (!value) return null
  if (typeof value === "string") return value
  if (typeof value === "number") return null
  if (value.url) return value.url
  if (value.filename) return `/media/${value.filename}`
  return null
}

export default function CTA({
  eyebrow,
  headline,
  description,
  primary,
  secondary,
  backgroundImage,
  anchor,
  dataBlockIndex,
  analytics,
}: CTAProps) {
  const eyebrowText = extractText(eyebrow)
  const descriptionText = extractText(description)
  const primaryLabel = primary?.label?.trim()
  const primaryHref = primary?.href?.trim()
  const showPrimary = Boolean(primaryLabel && primaryHref)
  const isContact = primaryHref?.startsWith("mailto:") || primaryHref?.startsWith("tel:")
  const secondaryLabel = secondary?.label?.trim()
  const secondaryHref = secondary?.href?.trim()
  const showSecondary = Boolean(secondaryLabel && secondaryHref)
  const backgroundImageUrl = mediaUrl(backgroundImage)
  const sectionId = anchor || (isContact ? "contact" : "wat-telt")
  const sectionClass = isContact
    ? "cms-block cms-block--cta cms-block--cta-contact relative isolate overflow-hidden border-t border-rule px-6 py-24 @min-[48rem]/site-frame:px-12 @min-[48rem]/site-frame:py-28 @min-[64rem]/site-frame:px-24"
    : "cms-block cms-block--cta cms-block--cta-quote relative isolate overflow-hidden bg-secondary/40 px-6 py-24 @min-[48rem]/site-frame:px-12 @min-[48rem]/site-frame:py-28"
  const contentClass = isContact
    ? "mx-auto max-w-3xl space-y-8 text-center"
    : "mx-auto max-w-3xl text-center"

  return (
    <section
      id={sectionId}
      class={sectionClass}
      data-block-index={dataBlockIndex}
      {...sectionAnalyticsAttrs(analytics, "cta", dataBlockIndex)}
    >
      {backgroundImageUrl && (
        <img
          aria-hidden="true"
          src={backgroundImageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          class="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.12]"
        />
      )}
      {(!isContact || backgroundImageUrl) && (
        <div
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-bg/70 via-bg/50 to-bg/70"
        />
      )}
      {!isContact && (
        <div
          aria-hidden="true"
          class="pointer-events-none absolute -bottom-[20%] -right-[10%] -z-10 h-[300px] w-[300px] rounded-full bg-accent/10 blur-3xl"
        />
      )}

      <div class={contentClass}>
        {eyebrowText && (
          <span
            class="inline-block -rotate-2 text-[20px] text-accent"
            style={{ fontFamily: "var(--font-script)" }}
          >
            {eyebrowText}
          </span>
        )}

        {isContact ? (
          <h2
            class="mx-auto max-w-[24ch] font-serif text-[28px] leading-[1.25] tracking-[-0.005em] text-ink-muted @min-[48rem]/site-frame:text-[36px]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <RtNodeRenderer node={headline} />
          </h2>
        ) : (
          <h3
            class="mt-5 font-serif text-[32px] italic leading-[1.2] tracking-[-0.005em] text-ink @min-[48rem]/site-frame:text-[48px]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            &ldquo;<RtNodeRenderer node={headline} />&rdquo;
          </h3>
        )}

        {descriptionText && (
          <p
            class="mx-auto mt-7 max-w-prose text-[16px] leading-[1.7] text-ink-muted @min-[48rem]/site-frame:text-[17px]"
            style={{ fontFamily: "var(--font-text)" }}
          >
            <RtNodeRenderer node={description} />
          </p>
        )}

        {(showPrimary || showSecondary) && (
          <div class={isContact ? "space-y-4" : "mt-6 flex flex-wrap items-center justify-center gap-3"}>
            {showPrimary && (
              <a
                href={primaryHref}
                class={isContact
                  ? "inline-block font-serif text-[28px] text-ink underline decoration-1 underline-offset-[8px] transition-colors hover:text-accent hover:decoration-accent @min-[48rem]/site-frame:text-[44px]"
                  : "inline-block rounded-md border border-rule px-6 py-3 text-[14px] font-medium text-ink transition-colors hover:border-accent hover:text-accent"
                }
                style={{ fontFamily: isContact ? "var(--font-heading)" : "var(--font-text)" }}
                {...actionAnalyticsAttrs("primary", primaryLabel)}
              >
                {primaryLabel}
              </a>
            )}
            {showSecondary && (
              <a
                href={secondaryHref}
                class="inline-block rounded-md border border-rule px-6 py-3 text-[14px] font-medium text-ink transition-colors hover:border-accent hover:text-accent"
                style={{ fontFamily: "var(--font-text)" }}
                {...actionAnalyticsAttrs("secondary", secondaryLabel)}
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
