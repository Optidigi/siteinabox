import * as React from "react"
import type { ContactSectionBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../analytics"
import { RichTextRenderer } from "../rich-text"
import type { BlockRenderOptions } from "./types"

const sourceVariantClassNames: Record<string, string> = {
  "hyperui-newsletter-centered": "cms-block--source-hyperui-newsletter-centered",
  "preline-centered-newsletter": "cms-block--source-preline-centered-newsletter",
  "tailwind-plus-newsletter-details": "cms-block--source-tailwind-plus-newsletter-details",
}

export function ContactSectionBlockRenderer({ block, options }: { block: ContactSectionBlock; options: BlockRenderOptions }) {
  const formAction = options.formAction ?? "/api/forms"
  const sectionVariant = block.analytics?.sectionVariant
  const sourceVariant = sectionVariant ? sourceVariantClassNames[sectionVariant] ?? "" : ""

  return (
    <section
      id={block.anchor || undefined}
      className={`cms-block cms-block--contact ${sourceVariant}`.trim()}
      data-source-variant={block.analytics?.sectionVariant || undefined}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "contactSection", options.index)}
    >
      {block.title && (
        <h2 className="cms-block__title" style={{ fontFamily: "var(--font-heading)" }}>
          <RichTextRenderer value={block.title} />
        </h2>
      )}
      {block.description && (
        <div className="cms-block__description" style={{ fontFamily: "var(--font-text)" }}>
          <RichTextRenderer value={block.description} />
        </div>
      )}
      <form
        className="cms-block__form"
        name={block.formName}
        method="POST"
        action={formAction}
        style={{ borderRadius: "var(--radius-md)" }}
        data-siab-analytics-form="true"
        data-siab-form-name={block.formName}
      >
        <input type="hidden" name="formName" value={block.formName} />
        {block.fields.map((field) => {
          const fieldId = `field-${field.name}`
          return (
            <div key={field.name} className="cms-block__form-field">
              <label className="cms-block__form-label" htmlFor={fieldId}>
                {field.label}{field.required ? " *" : ""}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  id={fieldId}
                  className="cms-block__form-input cms-block__form-input--textarea"
                  name={field.name}
                  required={field.required ?? false}
                  style={{ borderRadius: "var(--radius-sm)", fontFamily: "var(--font-text)" }}
                />
              ) : (
                <input
                  id={fieldId}
                  className="cms-block__form-input"
                  type={field.type}
                  name={field.name}
                  required={field.required ?? false}
                  style={{ borderRadius: "var(--radius-sm)", fontFamily: "var(--font-text)" }}
                />
              )}
            </div>
          )
        })}
        <button type="submit" className="cms-block__form-submit" style={{ borderRadius: "var(--radius-md)" }}>
          {block.submitLabel ?? "Send"}
        </button>
      </form>
    </section>
  )
}
