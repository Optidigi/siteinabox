import * as React from "react"
import type {
  BlogCardsBlock,
  ContactSectionBlock,
  FeatureListBlock,
  HeroBlock,
  LogoCloudBlock,
  PricingBlock,
  StatsBlock,
  TeamBlock,
} from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { resolveIcon } from "../blocks/icons"
import { mergeRendererSectionAttributes } from "../blocks/section-attributes"
import type { BlockRenderOptions } from "../blocks/types"
import { cx, richTextSlot } from "./utils"

export function TailwindPlusSimpleCenteredHero({ block, options }: { block: HeroBlock; options: BlockRenderOptions }) {
  const image = resolveMedia(block.image ?? null, options.mediaResolver)
  const ctaLabel = block.cta?.label?.trim()
  const ctaHref = block.cta?.href?.trim()
  const sectionProps = mergeRendererSectionAttributes(
    {
      id: block.anchor || undefined,
      className: "bg-white",
      "data-source-variant": block.designVariant ?? undefined,
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "hero", options.index),
    },
    options.sectionAttributes,
  )

  return (
    <section {...sectionProps}>
      <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          {(block.eyebrow || options.editSlots?.renderRichText) && (
            <div className="mb-8 flex justify-center">
              <div className="relative rounded-full px-3 py-1 text-sm/6 text-gray-600 ring-1 ring-gray-900/10 hover:ring-gray-900/20">
                {richTextSlot({
                  options,
                  name: "hero.eyebrow",
                  value: block.eyebrow,
                  variant: "inline",
                  elementPath: { blockIndex: options.index, field: "eyebrow" },
                  blockMode: "inline",
                })}
              </div>
            </div>
          )}
          <h1 className="text-5xl font-semibold tracking-tight text-balance text-gray-900 sm:text-7xl">
            {richTextSlot({
              options,
              name: "hero.headline",
              value: block.headline,
              variant: "inline",
              elementPath: { blockIndex: options.index, field: "headline" },
            })}
          </h1>
          {(block.subheadline || options.editSlots?.renderRichText) && (
            <div className="mt-8 text-lg font-medium text-pretty text-gray-500 sm:text-xl/8">
              {richTextSlot({
                options,
                name: "hero.subheadline",
                value: block.subheadline,
                variant: "block",
                elementPath: { blockIndex: options.index, field: "subheadline" },
              })}
            </div>
          )}
          {block.pills && block.pills.length > 0 && (
            <ul className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {block.pills.map((pill, i) => (
                <li key={pill.id ?? i} className="rounded-full bg-white px-3 py-1 text-sm font-medium text-gray-600 ring-1 ring-gray-900/10">
                  {options.editSlots?.renderText
                    ? options.editSlots.renderText({
                      name: "hero.pillLabel",
                      value: pill.label,
                      className: "contents",
                      elementPath: { blockIndex: options.index, field: "pills", itemIndex: i },
                    })
                    : pill.label}
                </li>
              ))}
            </ul>
          )}
          {((ctaLabel && ctaHref) || options.editSlots?.renderCta) && (
            <div className="mt-10 flex items-center justify-center gap-x-6">
              {options.editSlots?.renderCta
                ? options.editSlots.renderCta({
                  name: "hero.cta",
                  value: block.cta,
                  className: "rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
                  actionAttributes: actionAnalyticsAttrs("primary", ctaLabel),
                  elementPath: { blockIndex: options.index, field: "cta" },
                })
                : (
                  <a
                    href={ctaHref}
                    className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    {...actionAnalyticsAttrs("primary", ctaLabel)}
                  >
                    {ctaLabel}
                  </a>
                )}
            </div>
          )}
        </div>
        {image && (
          <div className="mt-16 flow-root sm:mt-24">
            <div className="-m-2 rounded-xl bg-gray-900/5 p-2 ring-1 ring-inset ring-gray-900/10 lg:-m-4 lg:rounded-2xl lg:p-4">
              <img className="rounded-md shadow-2xl ring-1 ring-gray-900/10" src={image.src} alt={image.alt ?? ""} loading="eager" decoding="async" />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export function TailwindPlusCentered2x2FeatureList({ block, options }: { block: FeatureListBlock; options: BlockRenderOptions }) {
  if ((!block.features || block.features.length === 0) && !options.editSlots) return null
  const features = block.features && block.features.length > 0
    ? block.features
    : ([{}] as Partial<NonNullable<FeatureListBlock["features"]>[number]>[])

  return (
    <section
      id={block.anchor || undefined}
      className="bg-white py-24 sm:py-32"
      data-source-variant={block.designVariant ?? undefined}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "featureList", options.index)}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          {(block.title || options.editSlots?.renderRichText) && (
            <h2 className="mt-2 text-4xl font-semibold tracking-tight text-pretty text-gray-900 sm:text-5xl lg:text-balance">
              {richTextSlot({
                options,
                name: "featureList.title",
                value: block.title,
                variant: "inline",
                elementPath: { blockIndex: options.index, field: "title" },
              })}
            </h2>
          )}
          {(block.intro || options.editSlots?.renderRichText) && (
            <div className="mt-6 text-lg/8 text-gray-600">
              {richTextSlot({
                options,
                name: "featureList.intro",
                value: block.intro,
                variant: "block",
                elementPath: { blockIndex: options.index, field: "intro" },
              })}
            </div>
          )}
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
            {features.map((feature, i) => {
              const Icon = resolveIcon(feature.icon)
              return (
                <div key={i} className="relative pl-16">
                  <dt className="text-base/7 font-semibold text-gray-900">
                    <div className="absolute top-0 left-0 flex size-10 items-center justify-center rounded-lg bg-indigo-600 text-white">
                      {options.editSlots?.renderIcon
                        ? options.editSlots.renderIcon({
                          name: "featureList.featureIcon",
                          value: feature.icon,
                          className: "size-6",
                          elementPath: { blockIndex: options.index, field: "features", itemIndex: i, subField: "icon" },
                        })
                        : Icon ? <Icon className="size-6" aria-hidden="true" /> : null}
                    </div>
                    {richTextSlot({
                      options,
                      name: "featureList.featureTitle",
                      value: feature.title,
                      variant: "inline",
                      elementPath: { blockIndex: options.index, field: "features", itemIndex: i, subField: "title" },
                    })}
                  </dt>
                  {(feature.description || options.editSlots?.renderRichText) && (
                    <dd className="mt-2 text-base/7 text-gray-600">
                      {richTextSlot({
                        options,
                        name: "featureList.featureDescription",
                        value: feature.description,
                        variant: "block",
                        elementPath: { blockIndex: options.index, field: "features", itemIndex: i, subField: "description" },
                      })}
                    </dd>
                  )}
                </div>
              )
            })}
          </dl>
        </div>
      </div>
    </section>
  )
}

export function TailwindPlusSimpleStats({ block, options }: { block: StatsBlock; options: BlockRenderOptions }) {
  if (!block.items.length) return null

  return (
    <section
      id={block.anchor || undefined}
      className="bg-white py-24 sm:py-32"
      data-source-variant={block.designVariant ?? undefined}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "stats", options.index)}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {(block.title || block.intro) && (
          <div className="mx-auto max-w-2xl lg:mx-0">
            {block.title && (
              <h2 className="text-4xl font-semibold tracking-tight text-pretty text-gray-900 sm:text-5xl">
                {richTextSlot({
                  options,
                  name: "stats.title",
                  value: block.title,
                  variant: "inline",
                  elementPath: { blockIndex: options.index, field: "title" },
                })}
              </h2>
            )}
            {block.intro && (
              <div className="mt-6 text-lg/8 text-gray-600">
                {richTextSlot({
                  options,
                  name: "stats.intro",
                  value: block.intro,
                  variant: "block",
                  elementPath: { blockIndex: options.index, field: "intro" },
                })}
              </div>
            )}
          </div>
        )}
        <dl className={cx("mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-10 text-gray-900 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-4", block.title || block.intro ? "mt-16" : "")}>
          {block.items.map((item, i) => (
            <div key={i} className="flex flex-col gap-y-3 border-l border-gray-900/10 pl-6">
              <dt className="text-sm/6 text-gray-600">{item.label}</dt>
              <dd className="order-first text-3xl font-semibold tracking-tight text-gray-900">{item.value}</dd>
              {item.description && (
                <div className="text-sm/6 text-gray-600">
                  {richTextSlot({
                    options,
                    name: "stats.description",
                    value: item.description,
                    variant: "block",
                    elementPath: { blockIndex: options.index, field: "items", itemIndex: i, subField: "description" },
                  })}
                </div>
              )}
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

export function TailwindPlusNewsletterDetails({ block, options }: { block: ContactSectionBlock; options: BlockRenderOptions }) {
  const provider = block.provider
  const formAction = provider?.action ?? provider?.fallbackHref ?? options.formAction ?? "/api/forms"
  const method = provider?.method ?? (provider?.provider === "mailto" ? "GET" : "POST")
  const primaryField = block.fields[0] ?? { name: "email", label: "Email", type: "email" as const, required: true }
  const fieldId = `field-${primaryField.name}`

  return (
    <section
      id={block.anchor || undefined}
      className="relative isolate overflow-hidden bg-gray-900 py-16 sm:py-24 lg:py-32"
      data-source-variant={block.designVariant ?? undefined}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "contactSection", options.index)}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2">
          <div className="max-w-xl lg:max-w-lg">
            {(block.title || options.editSlots?.renderRichText) && (
              <h2 className="text-4xl font-semibold tracking-tight text-white">
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
              <div className="mt-4 text-lg text-gray-300">
                {richTextSlot({
                  options,
                  name: "contactSection.description",
                  value: block.description,
                  variant: "block",
                  elementPath: { blockIndex: options.index, field: "description" },
                })}
              </div>
            )}
            <form
              className="mt-6 flex max-w-md gap-x-4"
              name={block.formName}
              method={method}
              action={formAction}
              data-siab-analytics-form="true"
              data-siab-form-name={block.formName}
              data-siab-form-provider={provider?.provider || undefined}
            >
              <input type="hidden" name="formName" value={block.formName} />
              <label htmlFor={fieldId} className="sr-only">{primaryField.label}</label>
              <input
                id={fieldId}
                name={primaryField.name}
                type={primaryField.type}
                required={primaryField.required ?? false}
                placeholder={primaryField.placeholder ?? primaryField.label}
                maxLength={primaryField.maxLength ?? undefined}
                className="min-w-0 flex-auto rounded-md bg-white/5 px-3.5 py-2 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6"
              />
              <button type="submit" className="flex-none rounded-md bg-indigo-500 px-3.5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
                {block.submitLabel ?? "Subscribe"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}

export function TailwindPlusSimplePricing({ block, options }: { block: PricingBlock; options: BlockRenderOptions }) {
  return (
    <section
      id={block.anchor || undefined}
      className="bg-white py-24 sm:py-32"
      data-source-variant={block.designVariant ?? undefined}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "pricing", options.index)}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          {block.title && (
            <h2 className="text-5xl font-semibold tracking-tight text-balance text-gray-900 sm:text-6xl">
              {richTextSlot({ options, name: "pricing.title", value: block.title, variant: "inline", elementPath: { blockIndex: options.index, field: "title" } })}
            </h2>
          )}
          {block.intro && (
            <div className="mx-auto mt-6 max-w-2xl text-center text-lg font-medium text-pretty text-gray-600 sm:text-xl/8">
              {richTextSlot({ options, name: "pricing.intro", value: block.intro, variant: "block", elementPath: { blockIndex: options.index, field: "intro" } })}
            </div>
          )}
        </div>
        <div className="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-y-8 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-2 lg:gap-x-8 xl:gap-x-12">
          {block.plans.map((plan, i) => {
            const ctaLabel = plan.cta?.label?.trim()
            const ctaHref = plan.cta?.href?.trim()
            return (
              <article key={i} className="rounded-3xl bg-white p-8 ring-1 ring-gray-900/10 xl:p-10 data-[highlighted=true]:bg-gray-900" data-highlighted={plan.highlighted ? "true" : undefined}>
                <h3 className="text-lg/8 font-semibold text-gray-900 data-[highlighted=true]:text-white">
                  {richTextSlot({ options, name: "pricing.planTitle", value: plan.title, variant: "inline", elementPath: { blockIndex: options.index, field: "plans", itemIndex: i, subField: "title" } })}
                </h3>
                {plan.description && (
                  <div className="mt-4 text-sm/6 text-gray-600">
                    {richTextSlot({ options, name: "pricing.planDescription", value: plan.description, variant: "block", elementPath: { blockIndex: options.index, field: "plans", itemIndex: i, subField: "description" } })}
                  </div>
                )}
                {plan.price && (
                  <p className="mt-6 flex items-baseline gap-x-1">
                    <span className="text-4xl font-semibold tracking-tight text-gray-900">{plan.price}</span>
                    {plan.period && <span className="text-sm/6 font-semibold text-gray-600">{plan.period}</span>}
                  </p>
                )}
                {ctaLabel && ctaHref && (
                  <a href={ctaHref} className="mt-8 block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm/6 font-semibold text-white shadow-xs hover:bg-indigo-500">
                    {ctaLabel}
                  </a>
                )}
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function TailwindPlusSimpleLogoCloud({ block, options }: { block: LogoCloudBlock; options: BlockRenderOptions }) {
  return (
    <section
      id={block.anchor || undefined}
      className="bg-white py-24 sm:py-32"
      data-source-variant={block.designVariant ?? undefined}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "logoCloud", options.index)}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {block.title && (
          <h2 className="text-center text-lg/8 font-semibold text-gray-900">
            {richTextSlot({ options, name: "logoCloud.title", value: block.title, variant: "inline", elementPath: { blockIndex: options.index, field: "title" } })}
          </h2>
        )}
        <div className="mx-auto mt-10 grid max-w-lg grid-cols-2 items-center gap-x-8 gap-y-10 sm:max-w-xl sm:grid-cols-3 sm:gap-x-10 lg:mx-0 lg:max-w-none lg:grid-cols-5">
          {block.logos.map((logo, i) => {
            const image = resolveMedia(logo.image, options.mediaResolver)
            if (!image) return null
            const img = <img className="col-span-1 max-h-12 w-full object-contain" src={image.src} alt={image.alt ?? logo.name} loading="lazy" decoding="async" />
            return logo.href ? <a key={i} href={logo.href}>{img}</a> : <div key={i}>{img}</div>
          })}
        </div>
      </div>
    </section>
  )
}

export function TailwindPlusTeamGrid({ block, options }: { block: TeamBlock; options: BlockRenderOptions }) {
  return (
    <section
      id={block.anchor || undefined}
      className="bg-white py-24 sm:py-32"
      data-source-variant={block.designVariant ?? undefined}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "team", options.index)}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:mx-0">
          {block.title && (
            <h2 className="text-4xl font-semibold tracking-tight text-pretty text-gray-900 sm:text-5xl">
              {richTextSlot({ options, name: "team.title", value: block.title, variant: "inline", elementPath: { blockIndex: options.index, field: "title" } })}
            </h2>
          )}
          {block.intro && (
            <div className="mt-6 text-lg/8 text-gray-600">
              {richTextSlot({ options, name: "team.intro", value: block.intro, variant: "block", elementPath: { blockIndex: options.index, field: "intro" } })}
            </div>
          )}
        </div>
        <ul role="list" className="mx-auto mt-20 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {block.members.map((member, i) => {
            const image = resolveMedia(member.image ?? null, options.mediaResolver)
            return (
              <li key={i}>
                {image && <img className="aspect-3/2 w-full rounded-2xl object-cover" src={image.src} alt={image.alt ?? member.name} loading="lazy" decoding="async" />}
                <h3 className="mt-6 text-lg/8 font-semibold tracking-tight text-gray-900">{member.name}</h3>
                {member.role && <p className="text-base/7 text-gray-600">{member.role}</p>}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export function TailwindPlusThreeColumnBlogCards({ block, options }: { block: BlogCardsBlock; options: BlockRenderOptions }) {
  return (
    <section
      id={block.anchor || undefined}
      className="bg-white py-24 sm:py-32"
      data-source-variant={block.designVariant ?? undefined}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "blogCards", options.index)}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:mx-0">
          {block.title && (
            <h2 className="text-4xl font-semibold tracking-tight text-pretty text-gray-900 sm:text-5xl">
              {richTextSlot({ options, name: "blogCards.title", value: block.title, variant: "inline", elementPath: { blockIndex: options.index, field: "title" } })}
            </h2>
          )}
          {block.intro && (
            <div className="mt-2 text-lg/8 text-gray-600">
              {richTextSlot({ options, name: "blogCards.intro", value: block.intro, variant: "block", elementPath: { blockIndex: options.index, field: "intro" } })}
            </div>
          )}
        </div>
        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {block.posts.map((post, i) => {
            const image = resolveMedia(post.image ?? null, options.mediaResolver)
            const article = (
              <article className="flex flex-col items-start justify-between">
                {image && <img className="aspect-video w-full rounded-2xl object-cover" src={image.src} alt={image.alt ?? ""} loading="lazy" decoding="async" />}
                <div className="max-w-xl">
                  {(post.date || post.author) && <div className="mt-8 flex items-center gap-x-4 text-xs text-gray-500">{post.date}{post.author ? ` / ${post.author}` : ""}</div>}
                  <h3 className="mt-3 text-lg/6 font-semibold text-gray-900">
                    {richTextSlot({ options, name: "blogCards.postTitle", value: post.title, variant: "inline", elementPath: { blockIndex: options.index, field: "posts", itemIndex: i, subField: "title" } })}
                  </h3>
                  {post.excerpt && (
                    <div className="mt-5 line-clamp-3 text-sm/6 text-gray-600">
                      {richTextSlot({ options, name: "blogCards.postExcerpt", value: post.excerpt, variant: "block", elementPath: { blockIndex: options.index, field: "posts", itemIndex: i, subField: "excerpt" } })}
                    </div>
                  )}
                </div>
              </article>
            )
            return post.href ? <a key={i} href={post.href}>{article}</a> : <div key={i}>{article}</div>
          })}
        </div>
      </div>
    </section>
  )
}
