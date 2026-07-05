import * as React from "react"
import type { NewsletterBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../analytics"
import { RichTextRenderer } from "../rich-text"
import { resolveIcon } from "./icons"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function NewsletterBlockRenderer({ block, options }: { block: NewsletterBlock; options: BlockRenderOptions }) {
  const provider = block.provider
  const formAction = provider?.action ?? provider?.fallbackHref ?? options.formAction ?? "/api/forms"
  const method = provider?.method ?? "POST"
  const sourceVariant = rendererVariantClassName(block)
  const emailLabel = block.emailLabel?.trim() || "Email address"
  const submitLabel = block.submitLabel?.trim() || "Subscribe"

  return (
    <section
      id={block.anchor || undefined}
      className={cx("cms-block cms-block--newsletter", sourceVariant, nativeBlockClassName(block, "section"))}
      data-source-variant={runtimeVariantDataAttribute(block)}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "newsletter", options.index)}
    >
      {(block.title || block.description) && (
        <div className={cx("cms-block__header", nativeBlockClassName(block, "header"))}>
          {block.title ? (
            <h2 className={cx("cms-block__title", nativeBlockClassName(block, "title"))} style={{ fontFamily: "var(--font-heading)" }}>
              <RichTextRenderer value={block.title} blockMode="inline" />
            </h2>
          ) : null}
          {block.description ? (
            <div className={cx("cms-block__description", nativeBlockClassName(block, "description"))} style={{ fontFamily: "var(--font-text)" }}>
              <RichTextRenderer value={block.description} />
            </div>
          ) : null}
        </div>
      )}
      <form
        className={cx("cms-block__form", nativeBlockClassName(block, "form"))}
        name="newsletter"
        method={method}
        action={formAction}
        data-siab-analytics-form="true"
        data-siab-form-name="newsletter"
        data-siab-form-provider={provider?.provider || undefined}
        data-siab-form-requires-consent={provider?.requiresConsent ? "true" : undefined}
      >
        <input type="hidden" name="formName" value="newsletter" />
        {provider?.hiddenFields?.map((field) => (
          <input key={field.name} type="hidden" name={field.name} value={field.value ?? ""} />
        ))}
        <label className={cx("cms-block__form-label", nativeBlockClassName(block, "label"))} htmlFor={`newsletter-email-${options.index}`}>
          {emailLabel}
        </label>
        <input
          id={`newsletter-email-${options.index}`}
          className={cx("cms-block__form-input", nativeBlockClassName(block, "input"))}
          type="email"
          name="email"
          required
          placeholder={block.emailPlaceholder ?? undefined}
          style={{ borderRadius: "var(--radius-sm)", fontFamily: "var(--font-text)" }}
        />
        {block.consentLabel ? (
          <label className="cms-block__form-consent">
            <input type="checkbox" name="consent" required={provider?.requiresConsent ?? false} />
            <span>{block.consentLabel}</span>
          </label>
        ) : null}
        <button type="submit" className={cx("cms-block__form-submit", nativeBlockClassName(block, "submit"))} style={{ borderRadius: "var(--radius-md)" }}>
          {submitLabel}
        </button>
      </form>
      {block.benefits?.length ? (
        <ul className={cx("cms-block__features", nativeBlockClassName(block, "list"))}>
          {block.benefits.map((benefit, index) => {
            const Icon = resolveIcon(benefit.icon)
            return (
              <li key={index} className={cx("cms-block__feature", nativeBlockClassName(block, "item"))}>
                {Icon ? <Icon aria-hidden="true" /> : null}
                <h3><RichTextRenderer value={benefit.title} blockMode="inline" /></h3>
                {benefit.description ? <RichTextRenderer value={benefit.description} /> : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
