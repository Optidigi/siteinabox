import * as React from "react"
import type { ContactSectionBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../../../../../analytics"
import { mergeRendererSectionAttributes } from "../../../../../blocks/section-attributes"
import type { BlockRenderOptions } from "../../../../../blocks/types"
import { RichTextRenderer } from "../../../../../rich-text"

const gradientClipPath =
  "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)"

function fieldAutocomplete(field: ContactSectionBlock["fields"][number]) {
  if (field.name === "first-name") return "given-name"
  if (field.name === "last-name") return "family-name"
  if (field.name === "company") return "organization"
  if (field.type === "email") return "email"
  if (field.type === "tel" || field.name.includes("phone")) return "tel"
  return undefined
}

function isPhoneField(field: ContactSectionBlock["fields"][number]) {
  return field.type === "tel" || field.name.includes("phone")
}

export function TailwindPlusMarketingContactCenteredRenderer({
  block,
  options,
}: {
  block: ContactSectionBlock
  options: BlockRenderOptions
}) {
  const slots = options.editSlots
  const provider = block.provider
  const formAction = provider?.action ?? provider?.fallbackHref ?? options.formAction ?? "/api/forms"
  const method = provider?.method ?? (provider?.provider === "mailto" ? "GET" : "POST")
  const hasSubmitStatus = method.toUpperCase() === "POST" && !formAction.startsWith("mailto:")
  const submitLabel = block.submitLabel ?? "Let's talk"
  const sectionProps = mergeRendererSectionAttributes(
    {
      id: block.anchor || undefined,
      className: "isolate bg-white px-6 py-24 sm:py-32 lg:px-8 cms-block cms-block--contact cms-block--source-tailwindplus-contact-centered",
      "data-provider-block": "tailwindplus",
      "data-provider-variant": "tailwindplus.marketing.contact.centered",
      "data-source-backed-block": "true",
      "data-source-variant": "tailwindplus.marketing.contact.centered",
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "contactSection", options.index),
    },
    options.sectionAttributes,
  )

  return (
    <section {...sectionProps}>
      <div aria-hidden="true" className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
        <div
          style={{ clipPath: gradientClipPath }}
          className="relative left-1/2 -z-10 aspect-1155/678 w-144.5 max-w-none -translate-x-1/2 rotate-30 bg-linear-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-40rem)] sm:w-288.75"
        />
      </div>
      <div className="mx-auto max-w-2xl text-center">
        {(block.title || slots?.renderRichText) && (
          <h2 className="text-4xl font-semibold tracking-tight text-balance text-gray-900 sm:text-5xl">
            {slots?.renderRichText
              ? slots.renderRichText({
                name: "contactSection.title",
                value: block.title,
                variant: "inline",
                className: "contents",
                elementPath: { blockIndex: options.index, field: "title" },
              })
              : <RichTextRenderer value={block.title} blockMode="inline" />}
          </h2>
        )}
        {(block.description || slots?.renderRichText) && (
          <div className="mt-2 text-lg/8 text-gray-600">
            {slots?.renderRichText
              ? slots.renderRichText({
                name: "contactSection.description",
                value: block.description,
                variant: "block",
                className: "contents",
                elementPath: { blockIndex: options.index, field: "description" },
              })
              : <RichTextRenderer value={block.description} />}
          </div>
        )}
      </div>
      <form
        action={formAction}
        method={method}
        className="mx-auto mt-16 max-w-xl sm:mt-20"
        name={block.formName}
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
            <label htmlFor={provider.honeypotField}>Leave this field empty</label>
            <input id={provider.honeypotField} name={provider.honeypotField} tabIndex={-1} autoComplete="off" />
          </div>
        )}
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
          {block.fields.slice(0, 6).map((field, index) => {
            const fieldClassName = index < 2 ? undefined : "sm:col-span-2"
            const autoComplete = fieldAutocomplete(field)
            const placeholder = field.placeholder ?? undefined
            return (
              <div key={field.name} className={fieldClassName}>
                <label htmlFor={field.name} className="block text-sm/6 font-semibold text-gray-900">
                  {slots?.renderText
                    ? slots.renderText({
                      name: "contactSection.fieldLabel",
                      value: field.label,
                      className: "contents",
                      placeholder: "Field label",
                      elementPath: { blockIndex: options.index, field: "fields", itemIndex: index, subField: "label" },
                    })
                    : field.label}
                </label>
                <div className="mt-2.5">
                  {field.type === "textarea" ? (
                    <textarea
                      id={field.name}
                      name={field.name}
                      rows={4}
                      required={field.required ?? false}
                      placeholder={placeholder}
                      maxLength={field.maxLength ?? undefined}
                      className="block w-full rounded-md bg-white px-3.5 py-2 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600"
                    />
                  ) : isPhoneField(field) ? (
                    <div className="flex rounded-md bg-white outline-1 -outline-offset-1 outline-gray-300 has-[input:focus-within]:outline-2 has-[input:focus-within]:-outline-offset-2 has-[input:focus-within]:outline-indigo-600">
                      <div className="grid shrink-0 grid-cols-1 focus-within:relative">
                        <select
                          id={`${field.name}-country`}
                          name={`${field.name}-country`}
                          autoComplete="country"
                          aria-label="Country"
                          className="col-start-1 row-start-1 w-full appearance-none rounded-md py-2 pr-7 pl-3.5 text-base text-gray-500 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                        >
                          <option>US</option>
                          <option>CA</option>
                          <option>EU</option>
                        </select>
                        <svg
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          data-slot="icon"
                          aria-hidden="true"
                          className="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-500 sm:size-4"
                        >
                          <path
                            d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
                            clipRule="evenodd"
                            fillRule="evenodd"
                          />
                        </svg>
                      </div>
                      <input
                        id={field.name}
                        type={field.type}
                        name={field.name}
                        required={field.required ?? false}
                        placeholder={placeholder}
                        maxLength={field.maxLength ?? undefined}
                        autoComplete={autoComplete}
                        className="block min-w-0 grow py-1.5 pr-3 pl-1 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none sm:text-sm/6"
                      />
                    </div>
                  ) : field.type === "select" ? (
                    <select
                      id={field.name}
                      name={field.name}
                      required={field.required ?? false}
                      className="block w-full rounded-md bg-white px-3.5 py-2 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600"
                    >
                      {(field.options ?? []).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : field.type === "checkbox" ? (
                    <input
                      id={field.name}
                      type="checkbox"
                      name={field.name}
                      required={field.required ?? false}
                      className="size-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                    />
                  ) : (
                    <input
                      id={field.name}
                      type={field.type}
                      name={field.name}
                      required={field.required ?? false}
                      placeholder={placeholder}
                      maxLength={field.maxLength ?? undefined}
                      autoComplete={autoComplete}
                      className="block w-full rounded-md bg-white px-3.5 py-2 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600"
                    />
                  )}
                </div>
              </div>
            )
          })}
          {provider?.requiresConsent && (
            <div className="flex gap-x-4 sm:col-span-2">
              <div className="flex h-6 items-center">
                <div className="group relative inline-flex w-8 shrink-0 rounded-full bg-gray-200 p-px inset-ring inset-ring-gray-900/5 outline-offset-2 outline-indigo-600 transition-colors duration-200 ease-in-out has-checked:bg-indigo-600 has-focus-visible:outline-2">
                  <span className="size-4 rounded-full bg-white shadow-xs ring-1 ring-gray-900/5 transition-transform duration-200 ease-in-out group-has-checked:translate-x-3.5" />
                  <input
                    id={`${block.formName}-agree-to-policies`}
                    type="checkbox"
                    name="agree-to-policies"
                    aria-label="Agree to policies"
                    required
                    className="absolute inset-0 size-full appearance-none focus:outline-hidden"
                  />
                </div>
              </div>
              <label htmlFor={`${block.formName}-agree-to-policies`} className="text-sm/6 text-gray-600">
                By selecting this, you agree to our <a href="#" className="font-semibold whitespace-nowrap text-indigo-600">privacy policy</a>.
              </label>
            </div>
          )}
        </div>
        <div className="mt-10">
          <button
            type="submit"
            className="block w-full rounded-md bg-indigo-600 px-3.5 py-2.5 text-center text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            {...actionAnalyticsAttrs("primary", submitLabel)}
          >
            {slots?.renderText
              ? slots.renderText({
                name: "contactSection.submitLabel",
                value: submitLabel,
                className: "contents",
                placeholder: "Submit",
                elementPath: { blockIndex: options.index, field: "submitLabel" },
              })
              : submitLabel}
          </button>
        </div>
        {hasSubmitStatus && (
          <p
            className="mt-4 text-sm/6 text-gray-600"
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
