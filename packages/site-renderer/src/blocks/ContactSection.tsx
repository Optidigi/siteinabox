import * as React from "react"
import type { ContactSectionBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../analytics"
import { RichTextRenderer } from "../rich-text"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function ContactSectionBlockRenderer({ block, options }: { block: ContactSectionBlock; options: BlockRenderOptions }) {
  const provider = block.provider
  const formAction = provider?.action ?? provider?.fallbackHref ?? options.formAction ?? "/api/forms"
  const method = provider?.method ?? (provider?.provider === "mailto" ? "GET" : "POST")
  const sourceVariant = rendererVariantClassName(block)

  return (
    <section
      id={block.anchor || undefined}
      className={`cms-block cms-block--contact ${sourceVariant}`.trim()}
      data-source-variant={runtimeVariantDataAttribute(block)}
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
        method={method}
        action={formAction}
        style={{ borderRadius: "var(--radius-md)" }}
        data-siab-analytics-form="true"
        data-siab-form-name={block.formName}
        data-siab-form-provider={provider?.provider || undefined}
        data-siab-form-requires-consent={provider?.requiresConsent ? "true" : undefined}
      >
        <input type="hidden" name="formName" value={block.formName} />
        {provider?.hiddenFields?.map((field) => (
          <input key={field.name} type="hidden" name={field.name} value={field.value ?? ""} />
        ))}
        {provider?.honeypotField && (
          <div className="cms-block__form-honeypot" aria-hidden="true">
            <label htmlFor={`field-${provider.honeypotField}`}>Leave this field empty</label>
            <input id={`field-${provider.honeypotField}`} name={provider.honeypotField} tabIndex={-1} autoComplete="off" />
          </div>
        )}
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
                  placeholder={field.placeholder ?? undefined}
                  maxLength={field.maxLength ?? undefined}
                  style={{ borderRadius: "var(--radius-sm)", fontFamily: "var(--font-text)" }}
                />
              ) : (
                <input
                  id={fieldId}
                  className="cms-block__form-input"
                  type={field.type}
                  name={field.name}
                  required={field.required ?? false}
                  placeholder={field.placeholder ?? undefined}
                  maxLength={field.maxLength ?? undefined}
                  style={{ borderRadius: "var(--radius-sm)", fontFamily: "var(--font-text)" }}
                />
              )}
            </div>
          )
        })}
        <button type="submit" className="cms-block__form-submit" style={{ borderRadius: "var(--radius-md)" }}>
          {block.submitLabel ?? "Send"}
        </button>
        {(provider?.successMessage || provider?.errorMessage) && (
          <p className="cms-block__form-message" data-success-message={provider.successMessage ?? undefined} data-error-message={provider.errorMessage ?? undefined}>
            {provider.successMessage ?? provider.errorMessage}
          </p>
        )}
      </form>
    </section>
  )
}
