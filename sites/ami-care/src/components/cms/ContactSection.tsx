import RtNodeRenderer from "./RtNodeRenderer"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "./analytics"
import type { AnalyticsBlockMetadata, RtField } from "../../lib/types"

export type ContactSectionProps = {
  title?: RtField
  description?: RtField
  formName: string
  submitLabel?: string | null
  fields: Array<{
    name: string
    label: string
    type: "text" | "email" | "tel" | "textarea"
    required?: boolean
  }>
  anchor?: string | null
  dataBlockIndex?: number
  analytics?: AnalyticsBlockMetadata | null
}

export default function ContactSection({
  title,
  description,
  formName,
  submitLabel,
  fields,
  anchor,
  dataBlockIndex,
  analytics,
}: ContactSectionProps) {
  if (!fields || fields.length === 0) return null
  return (
    <section
      id={anchor ?? undefined}
      class="cms-block cms-block--contact px-6 py-16 @min-[48rem]/site-frame:px-12 @min-[48rem]/site-frame:py-20"
      data-block-index={dataBlockIndex}
      {...sectionAnalyticsAttrs(analytics, "contactSection", dataBlockIndex)}
    >
      <div class="container mx-auto max-w-2xl">
        {title && (
          <h2
            class="font-serif text-[34px] leading-[1.1] tracking-[-0.01em] @min-[48rem]/site-frame:text-[44px]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <RtNodeRenderer node={title} />
          </h2>
        )}
        {description && (
          <p
            class="mt-3 text-[17px] leading-[1.6] text-ink-muted @min-[48rem]/site-frame:text-[18px]"
            style={{ fontFamily: "var(--font-text)" }}
          >
            <RtNodeRenderer node={description} />
          </p>
        )}
        <form
          name={formName}
          method="POST"
          action="/api/forms"
          class="mt-8 space-y-4"
          data-siab-analytics-form="true"
          data-siab-form-name={formName}
        >
          <input type="hidden" name="formName" value={formName} />
          {fields.map((field) => (
            <div key={field.name} class="space-y-1.5">
              <label
                htmlFor={`f-${field.name}`}
                class="block text-sm font-medium text-ink"
              >
                {field.label}
                {field.required && <span class="text-accent"> *</span>}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  id={`f-${field.name}`}
                  name={field.name}
                  required={!!field.required}
                  rows={5}
                  class="w-full rounded-md border border-rule bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                  style={{ fontFamily: "var(--font-text)" }}
                />
              ) : (
                <input
                  id={`f-${field.name}`}
                  name={field.name}
                  type={field.type}
                  required={!!field.required}
                  class="w-full rounded-md border border-rule bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                  style={{ fontFamily: "var(--font-text)" }}
                />
              )}
            </div>
          ))}
          <button
            type="submit"
            class="rounded-md bg-accent px-6 py-3 text-[14px] font-medium text-bg transition-colors hover:bg-accent/90"
            style={{ fontFamily: "var(--font-text)" }}
            {...actionAnalyticsAttrs("primary", submitLabel ?? "Send")}
          >
            {submitLabel ?? "Send"}
          </button>
        </form>
      </div>
    </section>
  )
}
