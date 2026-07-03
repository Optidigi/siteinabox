import * as React from "react"
import type { ContactSectionBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../analytics"
import { RichTextRenderer } from "../rich-text"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function ContactSectionBlockRenderer({ block, options }: { block: ContactSectionBlock; options: BlockRenderOptions }) {
  const provider = block.provider
  const formAction = provider?.action ?? provider?.fallbackHref ?? options.formAction ?? "/api/forms"
  const method = provider?.method ?? (provider?.provider === "mailto" ? "GET" : "POST")
  const hasSubmitStatus = method.toUpperCase() === "POST" && !formAction.startsWith("mailto:")
  const sourceVariant = rendererVariantClassName(block)

  return (
    <section
      id={block.anchor || undefined}
      className={cx("cms-block cms-block--contact", sourceVariant, nativeBlockClassName(block, "section"))}
      data-source-variant={runtimeVariantDataAttribute(block)}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "contactSection", options.index)}
    >
      {block.title && (
        <h2 className={cx("cms-block__title", nativeBlockClassName(block, "title"))} style={{ fontFamily: "var(--font-heading)" }}>
          <RichTextRenderer value={block.title} />
        </h2>
      )}
      {block.description && (
        <div className={cx("cms-block__description", nativeBlockClassName(block, "description"))} style={{ fontFamily: "var(--font-text)" }}>
          <RichTextRenderer value={block.description} />
        </div>
      )}
      <form
        className={cx("cms-block__form", nativeBlockClassName(block, "form"))}
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
            <div key={field.name} className={cx("cms-block__form-field", nativeBlockClassName(block, "formField"))}>
              <label className={cx("cms-block__form-label", nativeBlockClassName(block, "label"))} htmlFor={fieldId}>
                {field.label}{field.required ? " *" : ""}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  id={fieldId}
                  className={cx("cms-block__form-input cms-block__form-input--textarea", nativeBlockClassName(block, "input"), nativeBlockClassName(block, "textarea"))}
                  name={field.name}
                  required={field.required ?? false}
                  placeholder={field.placeholder ?? undefined}
                  maxLength={field.maxLength ?? undefined}
                  style={{ borderRadius: "var(--radius-sm)", fontFamily: "var(--font-text)" }}
                />
              ) : (
                <input
                  id={fieldId}
                  className={cx("cms-block__form-input", nativeBlockClassName(block, "input"))}
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
        <button type="submit" className={cx("cms-block__form-submit", nativeBlockClassName(block, "submit"))} style={{ borderRadius: "var(--radius-md)" }}>
          {block.submitLabel ?? "Send"}
        </button>
        {hasSubmitStatus && (
          <p
            className="cms-block__form-message"
            data-success-message={provider?.successMessage ?? undefined}
            data-error-message={provider?.errorMessage ?? undefined}
            hidden
            role="status"
          >
            {provider?.successMessage ?? provider?.errorMessage ?? ""}
          </p>
        )}
      </form>
    </section>
  )
}
