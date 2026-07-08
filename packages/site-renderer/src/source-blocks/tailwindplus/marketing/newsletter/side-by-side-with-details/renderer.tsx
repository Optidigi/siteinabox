import * as React from "react"
import type { NewsletterBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../../../../../analytics"
import { mergeRendererSectionAttributes } from "../../../../../blocks/section-attributes"
import type { BlockRenderOptions } from "../../../../../blocks/types"
import { richTextSlot } from "../../../../../source-blocks/utils"

const gradientClipPath =
  "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)"

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" data-slot="icon" aria-hidden="true" className="size-6 text-white">
      <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function HandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" data-slot="icon" aria-hidden="true" className="size-6 text-white">
      <path d="M10.05 4.575a1.575 1.575 0 1 0-3.15 0v3m3.15-3v-1.5a1.575 1.575 0 0 1 3.15 0v1.5m-3.15 0 .075 5.925m3.075.75V4.575m0 0a1.575 1.575 0 0 1 3.15 0V15M6.9 7.575a1.575 1.575 0 1 0-3.15 0v8.175a6.75 6.75 0 0 0 6.75 6.75h2.018a5.25 5.25 0 0 0 3.712-1.538l1.732-1.732a5.25 5.25 0 0 0 1.538-3.712l.003-2.024a.668.668 0 0 1 .198-.471 1.575 1.575 0 1 0-2.228-2.228 3.818 3.818 0 0 0-1.12 2.687M6.9 7.575V12m6.27 4.318A4.49 4.49 0 0 1 16.35 15m.002 0h-.002" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function TailwindPlusMarketingNewsletterSideBySideWithDetailsRenderer({
  block,
  options,
}: {
  block: NewsletterBlock
  options: BlockRenderOptions
}) {
  const provider = block.provider
  const action = provider?.action ?? provider?.fallbackHref ?? options.formAction ?? "/api/forms"
  const method = provider?.method ?? "POST"
  const normalizedMethod = method === "GET" ? "GET" : "POST"
  const hasSubmitStatus = normalizedMethod === "POST" && !action.startsWith("mailto:")
  const emailLabel = block.emailLabel?.trim() || "Email address"
  const submitLabel = block.submitLabel?.trim() || "Subscribe"
  const inputId = `tailwindplus-newsletter-email-${options.index}`
  const benefits = (block.benefits ?? []).slice(0, 2)
  const icons = [CalendarIcon, HandIcon]

  const sectionProps = mergeRendererSectionAttributes(
    {
      id: block.anchor || undefined,
      className: "relative isolate overflow-hidden bg-gray-900 py-16 sm:py-24 lg:py-32 cms-block cms-block--newsletter cms-block--source-tailwindplus-newsletter-side-by-side-with-details",
      "data-provider-block": "tailwindplus",
      "data-provider-variant": "tailwindplus.marketing.newsletter.side-by-side-with-details",
      "data-theme-zone": "fixed-dark",
      "data-source-backed-block": "true",
      "data-source-variant": "tailwindplus.marketing.newsletter.side-by-side-with-details",
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "newsletter", options.index),
    },
    options.sectionAttributes,
  )

  return (
    <section {...sectionProps}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2">
          <div className="max-w-xl lg:max-w-lg">
            <h2 className="text-4xl font-semibold tracking-tight text-white">
              {richTextSlot({
                options,
                name: "newsletter.title",
                value: block.title,
                variant: "inline",
                className: "contents",
                elementPath: { blockIndex: options.index, field: "title" },
                blockMode: "inline",
              })}
            </h2>
            {(block.description || options.editSlots?.renderRichText) && (
              <div className="mt-4 text-lg text-gray-300">
                {richTextSlot({
                  options,
                  name: "newsletter.description",
                  value: block.description,
                  variant: "block",
                  className: "contents",
                  elementPath: { blockIndex: options.index, field: "description" },
                })}
              </div>
            )}
            <form
              className="mt-6 flex max-w-md gap-x-4"
              name="newsletter"
              method={normalizedMethod}
              action={action}
              data-siab-analytics-form="true"
              data-siab-form-name="newsletter"
              data-siab-form-provider={provider?.provider || undefined}
            >
              <input type="hidden" name="formName" value="newsletter" />
              {provider?.hiddenFields?.map((field) => (
                <input key={field.name} type="hidden" name={field.name} value={field.value ?? ""} />
              ))}
              {provider?.honeypotField && (
                <div className="hidden" aria-hidden="true">
                  <label htmlFor={provider.honeypotField}>Leave this field empty</label>
                  <input id={provider.honeypotField} name={provider.honeypotField} tabIndex={-1} autoComplete="off" />
                </div>
              )}
              <label htmlFor={inputId} className="sr-only">{emailLabel}</label>
              <input id={inputId} type="email" name="email" required placeholder={block.emailPlaceholder ?? "Enter your email"} autoComplete="email" className="min-w-0 flex-auto rounded-md bg-white/5 px-3.5 py-2 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6" />
              <button type="submit" className="flex-none rounded-md bg-indigo-500 px-3.5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
                {options.editSlots?.renderText
                  ? options.editSlots.renderText({
                    name: "newsletter.submitLabel",
                    value: submitLabel,
                    placeholder: "Subscribe",
                    elementPath: { blockIndex: options.index, field: "submitLabel" },
                  })
                  : submitLabel}
              </button>
              {hasSubmitStatus && (
                <p
                  className="cms-block__form-message sr-only"
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
          <dl className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:pt-2">
            {benefits.map((benefit, index) => {
              const Icon = icons[index] ?? CalendarIcon
              return (
                <div key={index} className="flex flex-col items-start">
                  <div className="rounded-md bg-white/5 p-2 ring-1 ring-white/10"><Icon /></div>
                  <dt className="mt-4 text-base font-semibold text-white">
                    {richTextSlot({
                      options,
                      name: "newsletter.benefitTitle",
                      value: benefit.title,
                      variant: "inline",
                      className: "contents",
                      elementPath: { blockIndex: options.index, field: "benefits", itemIndex: index, subField: "title" },
                      blockMode: "inline",
                    })}
                  </dt>
                  {(benefit.description || options.editSlots?.renderRichText) ? (
                    <dd className="mt-2 text-base/7 text-gray-400">
                      {richTextSlot({
                        options,
                        name: "newsletter.benefitDescription",
                        value: benefit.description,
                        variant: "block",
                        className: "contents",
                        elementPath: { blockIndex: options.index, field: "benefits", itemIndex: index, subField: "description" },
                      })}
                    </dd>
                  ) : null}
                </div>
              )
            })}
          </dl>
        </div>
      </div>
      <div aria-hidden="true" className="absolute top-0 left-1/2 -z-10 -translate-x-1/2 blur-3xl xl:-top-6">
        <div style={{ clipPath: gradientClipPath }} className="siab-source-clip-tailwindplus-glow aspect-1155/678 w-288.75 bg-linear-to-tr from-[#ff80b5] to-[#9089fc] opacity-30" />
      </div>
    </section>
  )
}
