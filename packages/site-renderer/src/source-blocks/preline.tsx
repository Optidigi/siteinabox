import * as React from "react"
import type { ContactSectionBlock, GalleryBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import type { BlockRenderOptions } from "../blocks/types"
import { providerTokenStyles, richTextSlot } from "./utils"

function contactFormMeta(block: ContactSectionBlock, options: BlockRenderOptions) {
  const provider = block.provider
  const formAction = provider?.action ?? provider?.fallbackHref ?? options.formAction ?? "/api/forms"
  const method = provider?.method ?? (provider?.provider === "mailto" ? "GET" : "POST")
  const hasSubmitStatus = method.toUpperCase() === "POST" && !formAction.startsWith("mailto:")
  return { provider, formAction, method, hasSubmitStatus }
}

export function PrelineCenteredNewsletter({ block, options }: { block: ContactSectionBlock; options: BlockRenderOptions }) {
  const { provider, formAction, method, hasSubmitStatus } = contactFormMeta(block, options)
  const primaryField = block.fields[0] ?? { name: "email", label: "Email", type: "email" as const, required: true }
  const fieldId = `field-${primaryField.name}`

  return (
    <section
      id={block.anchor || undefined}
      data-source-variant={block.designVariant ?? undefined}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "contactSection", options.index)}
    >
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-xl text-center">
          {(block.title || options.editSlots?.renderRichText) && (
            <h2 className="block text-2xl font-bold text-[var(--color-ink)] md:text-3xl md:leading-tight" style={providerTokenStyles.heading}>
              {richTextSlot({
                options,
                name: "contactSection.title",
                value: block.title,
                variant: "inline",
                elementPath: { blockIndex: options.index, field: "title" },
              })}
            </h2>
          )}
          {(block.description || options.editSlots?.renderRichText) && (
            <div className="mt-4 text-[var(--color-ink-muted)]" style={providerTokenStyles.text}>
              {richTextSlot({
                options,
                name: "contactSection.description",
                value: block.description,
                variant: "block",
                elementPath: { blockIndex: options.index, field: "description" },
              })}
            </div>
          )}
        </div>

        <form
          className="mx-auto mt-5 flex max-w-xl flex-col items-center gap-2 sm:flex-row sm:gap-3 lg:mt-8"
          name={block.formName}
          method={method}
          action={formAction}
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
            <div className="hidden" aria-hidden="true">
              <label htmlFor={`field-${provider.honeypotField}`}>Leave this field empty</label>
              <input id={`field-${provider.honeypotField}`} name={provider.honeypotField} tabIndex={-1} autoComplete="off" />
            </div>
          )}
          <div className="w-full">
            <label htmlFor={fieldId} className="sr-only">{primaryField.label}</label>
            <input
              id={fieldId}
              name={primaryField.name}
              type={primaryField.type}
              required={primaryField.required ?? false}
              placeholder={primaryField.placeholder ?? primaryField.label}
              maxLength={primaryField.maxLength ?? undefined}
              className="block w-full rounded-[var(--radius-lg)] border-[var(--color-rule)] bg-[var(--color-card)] px-4 py-2.5 text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:border-[var(--color-accent)] focus:ring-[var(--color-accent)] disabled:pointer-events-none disabled:opacity-50 sm:py-3 sm:text-sm"
            />
          </div>
          <button
            className="inline-flex w-full items-center justify-center gap-x-2 whitespace-nowrap rounded-[var(--radius-lg)] border border-transparent bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-[var(--color-on-accent)] hover:brightness-95 focus:brightness-95 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
            type="submit"
          >
            {block.submitLabel ?? "Subscribe"}
          </button>
          {hasSubmitStatus && (
            <p
              className="sr-only"
              data-success-message={provider?.successMessage ?? undefined}
              data-error-message={provider?.errorMessage ?? undefined}
              hidden
              role="status"
            >
              {provider?.successMessage ?? provider?.errorMessage ?? ""}
            </p>
          )}
        </form>
      </div>
    </section>
  )
}

export function PrelineSquareGridGallery({ block, options }: { block: GalleryBlock; options: BlockRenderOptions }) {
  return (
    <section
      id={block.anchor || undefined}
      data-source-variant={block.designVariant ?? undefined}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "gallery", options.index)}
    >
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        {(block.title || block.intro) && (
          <div className="mx-auto mb-10 max-w-2xl text-center">
            {block.title && (
              <h2 className="text-2xl font-bold text-[var(--color-ink)] md:text-4xl md:leading-tight" style={providerTokenStyles.heading}>
                {richTextSlot({ options, name: "gallery.title", value: block.title, variant: "inline", elementPath: { blockIndex: options.index, field: "title" } })}
              </h2>
            )}
            {block.intro && (
              <div className="mt-3 text-[var(--color-ink-muted)]" style={providerTokenStyles.text}>
                {richTextSlot({ options, name: "gallery.intro", value: block.intro, variant: "block", elementPath: { blockIndex: options.index, field: "intro" } })}
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {block.images.map((item, i) => {
            const image = resolveMedia(item.image, options.mediaResolver)
            if (!image) return null
            return (
              <div key={i} className="group block overflow-hidden">
                <img className="size-full aspect-square object-cover transition duration-300 group-hover:scale-105" src={image.src} alt={image.alt ?? ""} loading="lazy" decoding="async" />
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
