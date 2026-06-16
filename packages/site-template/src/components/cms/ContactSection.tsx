import { RtNodeRenderer } from "./RtNodeRenderer"
import { BlockErrorBoundary } from "./BlockErrorBoundary"
import { sectionAnalyticsAttrs } from "./analytics"
import type { AnalyticsBlockMetadata, RtRoot } from "../../lib/types"

/**
 * ContactSection block renderer (Preact). Structure-only.
 * Props mirror siab-payload/src/blocks/ContactSection.ts.
 *
 * title + description are RtRoot. formName + submitLabel + fields
 * define the form. Submissions post to Payload's public forms endpoint; the
 * deploy/reverse-proxy contract routes `/api/forms` to the CMS.
 */
export type ContactSectionField = {
  name: string
  label: string
  type: "text" | "email" | "tel" | "textarea"
  required?: boolean
}

export type ContactSectionProps = {
  anchor?: string | null
  title?: RtRoot | null
  description?: RtRoot | null
  formName: string
  submitLabel?: string | null
  fields: ContactSectionField[]
  dataBlockIndex?: number
  analytics?: AnalyticsBlockMetadata | null
}

export default function ContactSection(props: ContactSectionProps) {
  const { anchor, title, description, formName, submitLabel, fields, dataBlockIndex, analytics } = props
  return (
    <BlockErrorBoundary blockType="contactSection">
      <section
        id={anchor || undefined}
        class="cms-block cms-block--contact"
        data-block-index={dataBlockIndex}
        {...sectionAnalyticsAttrs(analytics, "contactSection", dataBlockIndex)}
      >
        {title && (
          <h2 class="cms-block__title" style={{ fontFamily: "var(--font-heading)" }}>
            <RtNodeRenderer node={title} />
          </h2>
        )}
        {description && (
          <div class="cms-block__description" style={{ fontFamily: "var(--font-text)" }}>
            <RtNodeRenderer node={description} />
          </div>
        )}
        <form
          class="cms-block__form"
          name={formName}
          method="POST"
          action="/api/forms"
          style={{ borderRadius: "var(--radius-md)" }}
          data-siab-analytics-form="true"
          data-siab-form-name={formName}
        >
          <input type="hidden" name="formName" value={formName} />
          {fields.map((f) => (
            <div key={f.name} class="cms-block__form-field">
              <label class="cms-block__form-label" htmlFor={`field-${f.name}`}>
                {f.label}{f.required ? " *" : ""}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  id={`field-${f.name}`}
                  class="cms-block__form-input cms-block__form-input--textarea"
                  name={f.name}
                  required={f.required ?? false}
                  style={{ borderRadius: "var(--radius-sm)", fontFamily: "var(--font-text)" }}
                />
              ) : (
                <input
                  id={`field-${f.name}`}
                  class="cms-block__form-input"
                  type={f.type}
                  name={f.name}
                  required={f.required ?? false}
                  style={{ borderRadius: "var(--radius-sm)", fontFamily: "var(--font-text)" }}
                />
              )}
            </div>
          ))}
          <button
            type="submit"
            class="cms-block__form-submit"
            style={{ borderRadius: "var(--radius-md)" }}
          >
            {submitLabel ?? "Send"}
          </button>
        </form>
      </section>
    </BlockErrorBoundary>
  )
}
