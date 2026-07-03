"use client"
import * as React from "react"
import { RtSlot } from "../inline/RtSlot"
import {
  canvasSourceVariantClassName,
  canvasSourceVariantDataAttribute,
  mergeCanvasSectionProps,
  type CanvasBlockRendererProps,
} from "@/components/editor/canvas/CanvasBlockRenderer"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"

/**
 * Canvas-mode renderer for the ContactSection block.
 *
 * Emits the shared renderer contact-section DOM class structure
 * so tenant CSS targets the same classes.
 *
 * Editable fields: title (inline rich-text), description (block rich-text).
 * Non-editable: formName, fields[] — those are configured in the sidebar
 * BlockFieldsPanel. The form preview is rendered read-only/pointer-events-none
 * so the editor can see the shape without accidentally interacting with inputs.
 */
export const ContactSectionCanvas: React.FC<CanvasBlockRendererProps> = ({
  block,
  isActive,
  manifest,
  onActivate,
  onUpdate,
  legacyTenant,
  sectionChromeProps,
}) => {
  const t = useTranslations("editor")
  const set = (field: string) => (value: any) => onUpdate({ ...block, [field]: value })
  const idx = block.__index as number

  const fields: Array<{ name: string; label: string; type: string; required: boolean }> =
    block.fields ?? []
  const isAmicareLegacy = legacyTenant === "amicare"
  const sectionProps = mergeCanvasSectionProps(
    {
      id: block.anchor || undefined,
      className: `cms-block cms-block--contact px-6 py-16 @min-[48rem]/site-frame:px-12 @min-[48rem]/site-frame:py-20 ${canvasSourceVariantClassName(block, legacyTenant, { rendererDom: "legacy" })}`.trim(),
      "data-source-variant": canvasSourceVariantDataAttribute(block, legacyTenant),
      "data-block-index": block.__index ?? undefined,
      "data-active": isActive || undefined,
      onClick: onActivate,
    },
    sectionChromeProps,
  )

  return (
    <section {...sectionProps}>
      <div className="container mx-auto max-w-2xl">
        <RtSlot
          as="h2"
          variant="inline"
          manifest={manifest}
          value={block.title}
          onChange={set("title")}
          className="font-serif text-[34px] leading-[1.1] tracking-[-0.01em] @min-[48rem]/site-frame:text-[44px] [font-family:var(--font-heading)]"
          placeholder={t("sectionTitlePlaceholder")}
          elementPath={{ blockIndex: idx, field: "title" }}
        />

        <RtSlot
          as="p"
          variant="block"
          manifest={manifest}
          value={block.description}
          onChange={set("description")}
          className="mt-3 text-[17px] leading-[1.6] text-ink-muted @min-[48rem]/site-frame:text-[18px] [font-family:var(--font-text)]"
          placeholder={t("supportingDescriptionPlaceholder")}
          elementPath={{ blockIndex: idx, field: "description" }}
        />

        {/* Form preview — read-only, pointer-events-none so editor can't interact */}
        <div className="pointer-events-none">
          <form
            name={block.formName ?? "contact"}
            method="POST"
            action="/api/forms"
            className="mt-8 space-y-4"
            onClick={(e) => e.preventDefault()}
          >
            <input type="hidden" name="formName" value={block.formName ?? ""} readOnly />
            {fields.map((field, i) => (
              <div key={i} className="space-y-1.5">
                <label
                  htmlFor={`f-${field.name}`}
                  className="block text-sm font-medium text-ink"
                >
                  {field.label}
                  {field.required && <span className="text-accent"> *</span>}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    id={`f-${field.name}`}
                    rows={5}
                    readOnly
                    tabIndex={-1}
                    className="w-full rounded-md border border-rule bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent [font-family:var(--font-text)]"
                  />
                ) : (
                  <input
                    id={`f-${field.name}`}
                    type={field.type}
                    readOnly
                    tabIndex={-1}
                    className="w-full rounded-md border border-rule bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent [font-family:var(--font-text)]"
                  />
                )}
              </div>
            ))}
            <button
              type="button"
              tabIndex={-1}
              className={cn(
                "rounded-md bg-accent px-6 py-3 text-[14px] font-medium transition-colors hover:bg-accent/90 [font-family:var(--font-text)]",
                isAmicareLegacy ? "amicare-button-primary" : "text-bg",
              )}
            >
              {block.submitLabel ?? "Send"}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
