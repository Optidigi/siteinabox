"use client"
import * as React from "react"
import { RtSlot } from "../inline/RtSlot"
import { InlineCtaButton } from "../inline/InlineCtaButton"
import { InlineImage } from "../inline/InlineImage"
import {
  canvasSourceVariantClassName,
  canvasSourceVariantDataAttribute,
  mergeCanvasSectionProps,
  type CanvasBlockRendererProps,
} from "@/components/editor/canvas/CanvasBlockRenderer"
import { resolveBlockAnchor } from "@siteinabox/site-renderer"
import { useTranslations } from "next-intl"
import { cn } from "@siteinabox/ui/lib/utils"

/**
 * Canvas-mode renderer for the CTA block.
 *
 * Emits the shared renderer CTA DOM class structure
 * so tenant CSS targets the same classes.
 *
 * Variant classes follow the site renderer, but every CTA field remains
 * optional and editable. If a field is present, the canvas renders it.
 */
export const CTACanvas: React.FC<CanvasBlockRendererProps> = ({ block, isActive, manifest, onActivate, onUpdate, tenantId, legacyTenant, sectionChromeProps }) => {
  const t = useTranslations("editor")
  const set = (field: string) => (value: any) => onUpdate({ ...block, [field]: value })
  const setPrimary = (value: any) => onUpdate({ ...block, primary: value })
  const setSecondary = (value: any) => onUpdate({ ...block, secondary: value })
  const idx = block.__index as number
  const isAmicareLegacy = legacyTenant === "amicare"

  const primaryHref: string | null | undefined = block.primary?.href?.trim()
  const isContact =
    primaryHref?.startsWith("mailto:") || primaryHref?.startsWith("tel:")
  const setContactCta = (value: any) => onUpdate({ ...block, primary: value, secondary: null })
  const sectionId = resolveBlockAnchor(block, { legacyTenant, surface: "canvas" })
  const sectionClassName = isContact
    ? "cms-block cms-block--cta cms-block--cta-contact relative isolate overflow-hidden border-t border-rule px-6 py-24 @min-[48rem]/site-frame:px-12 @min-[48rem]/site-frame:py-28 @min-[64rem]/site-frame:px-24"
    : "cms-block cms-block--cta cms-block--cta-quote relative isolate overflow-hidden bg-secondary/40 px-6 py-24 @min-[48rem]/site-frame:px-12 @min-[48rem]/site-frame:py-28"
  const contentClassName = isContact
    ? "mx-auto max-w-3xl space-y-8 text-center"
    : "mx-auto max-w-3xl text-center"
  const headlineClassName = isContact
    ? "mx-auto max-w-[24ch] font-serif text-[28px] leading-[1.25] tracking-[-0.005em] text-ink-muted @min-[48rem]/site-frame:text-[36px] [font-family:var(--font-heading)]"
    : "font-serif text-[32px] italic leading-[1.2] tracking-[-0.005em] text-ink @min-[48rem]/site-frame:text-[48px] [font-family:var(--font-heading)]"
  const sectionProps = mergeCanvasSectionProps(
    {
      id: sectionId,
      className: `${sectionClassName} ${canvasSourceVariantClassName(block, legacyTenant, { rendererDom: "legacy" })}`.trim(),
      "data-source-variant": canvasSourceVariantDataAttribute(block, legacyTenant),
      "data-block-index": block.__index ?? undefined,
      "data-active": isActive || undefined,
      onClick: onActivate,
    },
    sectionChromeProps,
  )

  return (
    <section {...sectionProps}>
      <InlineImage
        value={block.backgroundImage}
        onChange={set("backgroundImage")}
        alt=""
        className="absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.12]"
        chrome="overlay"
        emptyLabel={t("addBackgroundImage")}
        changeLabel={t("changeBackgroundImage")}
        removeLabel={t("removeBackgroundImage")}
        openOnImageClick={false}
        tenantId={tenantId ?? undefined}
        elementPath={{ blockIndex: idx, field: "backgroundImage" }}
      />
      {(!isContact || block.backgroundImage) && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 -z-10",
            isAmicareLegacy ? "amicare-quote-overlay" : "bg-gradient-to-b from-bg/70 via-bg/50 to-bg/70",
          )}
        />
      )}
      {!isContact && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -bottom-[20%] -right-[10%] -z-10 h-[300px] w-[300px] rounded-full blur-3xl",
            isAmicareLegacy ? "amicare-quote-glow" : "bg-accent/10",
          )}
        />
      )}

      <div className={contentClassName}>
        <RtSlot
          as="span"
          variant="inline"
          manifest={manifest}
          value={block.eyebrow}
          onChange={set("eyebrow")}
          className="inline-block -rotate-2 text-[20px] text-accent [font-family:var(--font-script)]"
          placeholder={t("eyebrowPlaceholder")}
          elementPath={{ blockIndex: idx, field: "eyebrow" }}
        />

        {isContact ? (
          <RtSlot
            as="h2"
            variant="inline"
            manifest={manifest}
            value={block.headline}
            onChange={set("headline")}
            className={headlineClassName}
            placeholder={t("headlinePlaceholder")}
            elementPath={{ blockIndex: idx, field: "headline" }}
          />
        ) : (
          <h3 className="mt-5 font-serif text-[32px] italic leading-[1.2] tracking-[-0.005em] text-ink @min-[48rem]/site-frame:text-[48px] [font-family:var(--font-heading)]">
            &ldquo;
            <RtSlot
              variant="inline"
              manifest={manifest}
              value={block.headline}
              onChange={set("headline")}
              className={headlineClassName}
              placeholder={t("quotePlaceholder")}
              elementPath={{ blockIndex: idx, field: "headline" }}
            />
            &rdquo;
          </h3>
        )}

        <RtSlot
          as="p"
          variant="block"
          manifest={manifest}
          value={block.description}
          onChange={set("description")}
          className="mx-auto mt-7 max-w-prose text-[16px] leading-[1.7] text-ink-muted @min-[48rem]/site-frame:text-[17px] [font-family:var(--font-text)]"
          placeholder={t("descriptionPlaceholder")}
          elementPath={{ blockIndex: idx, field: "description" }}
        />

        {isContact ? (
          <div className="space-y-4">
            <InlineCtaButton
              value={block.primary}
              onChange={setContactCta}
              className="inline-block font-serif text-[28px] text-ink underline decoration-1 underline-offset-[8px] transition-colors hover:text-accent hover:decoration-accent @min-[48rem]/site-frame:text-[44px]"
              emptyLabel={t("addContactLink")}
              elementPath={{ blockIndex: idx, field: "primary" }}
            />
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <InlineCtaButton
              value={block.primary}
              onChange={setPrimary}
              className="inline-block rounded-md border border-rule px-6 py-3 text-[14px] font-medium text-ink transition-colors hover:border-accent hover:text-accent [font-family:var(--font-text)]"
              emptyLabel={t("addContactLink")}
              elementPath={{ blockIndex: idx, field: "primary" }}
            />
            <InlineCtaButton
              value={block.secondary}
              onChange={setSecondary}
              className="inline-block rounded-md border border-rule px-6 py-3 text-[14px] font-medium text-ink transition-colors hover:border-accent hover:text-accent [font-family:var(--font-text)]"
              emptyLabel={t("addCtaButton")}
              elementPath={{ blockIndex: idx, field: "secondary" }}
            />
          </div>
        )}
      </div>
    </section>
  )
}
