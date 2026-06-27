"use client"
import * as React from "react"
import {
  SITE_GENERATION_BLOCK_CATALOG_BY_SLUG,
  SITE_GENERATION_BLOCK_SLUGS,
  type SiteBlockCatalogVariant,
  type SiteGenerationBlockSlug,
} from "@siteinabox/contracts"
import { InlineCtaButton } from "../inline/InlineCtaButton"
import { InlineIcon } from "../inline/InlineIcon"
import { InlineImage } from "../inline/InlineImage"
import { RtSlot } from "../inline/RtSlot"
import type { CanvasBlockRendererProps } from "@/components/editor/canvas/CanvasBlockRenderer"

const generationBlockSlugs = new Set<string>(SITE_GENERATION_BLOCK_SLUGS)

function resolvedSourceVariant(block: any): SiteBlockCatalogVariant | undefined {
  if (!generationBlockSlugs.has(block?.blockType)) return undefined
  const catalog = SITE_GENERATION_BLOCK_CATALOG_BY_SLUG[block.blockType as SiteGenerationBlockSlug]
  const variant = typeof block.variant === "string" ? block.variant.trim() : ""
  const sectionVariant = typeof block.analytics?.sectionVariant === "string" ? block.analytics.sectionVariant.trim() : ""
  const match = (catalog.variants as readonly SiteBlockCatalogVariant[]).find((entry) =>
    variant ? entry.variant === variant : entry.sectionVariant === sectionVariant
  )
  return match
}

function sourceVariantDataAttribute(block: any) {
  return resolvedSourceVariant(block)?.variant
}

function sourceVariantClassName(block: any) {
  return resolvedSourceVariant(block)?.rendererClassName ?? ""
}

const setField = (block: any, onUpdate: (next: any) => void) => (field: string) => (value: any) =>
  onUpdate({ ...block, [field]: value })

const setArrayItemField = (
  block: any,
  onUpdate: (next: any) => void,
  field: string,
  index: number,
  subField: string,
) => (value: any) => {
  const next = [...(block[field] ?? [])]
  next[index] = { ...(next[index] ?? {}), [subField]: value }
  onUpdate({ ...block, [field]: next })
}

export const MediaHeroCanvas: React.FC<CanvasBlockRendererProps> = ({
  block,
  isActive,
  manifest,
  onActivate,
  onUpdate,
}) => {
  const set = setField(block, onUpdate)
  const idx = block.__index as number
  const minHeight = block.minHeight ?? "standard"
  const align = block.contentAlign ?? "left"
  const width = block.contentWidth ?? "narrow"

  return (
    <section
      id={block.anchor || undefined}
      className={`cms-block cms-block--mediaHero cms-block--mediaHero-${minHeight} cms-block--mediaHero-align-${align} cms-block--mediaHero-width-${width} ${sourceVariantClassName(block)}`.trim()}
      data-source-variant={sourceVariantDataAttribute(block)}
      data-block-index={block.__index ?? undefined}
      data-active={isActive || undefined}
      data-shape-top={block.shapeDividers?.top || undefined}
      data-shape-bottom={block.shapeDividers?.bottom || undefined}
      onClick={onActivate}
    >
      <InlineImage
        value={block.backgroundImage}
        onChange={set("backgroundImage")}
        className="cms-block__mediaHero-bg"
        chrome="overlay"
        openOnImageClick={false}
        elementPath={{ blockIndex: idx, field: "backgroundImage" }}
      />
      <div className="cms-block__mediaHero-scrim" aria-hidden="true" />
      <div className="cms-block__mediaHero-content">
        <div className="cms-block__eyebrow">
          <RtSlot
            as="span"
            variant="inline"
            manifest={manifest}
            value={block.eyebrow}
            onChange={set("eyebrow")}
            placeholder="Eyebrow"
            elementPath={{ blockIndex: idx, field: "eyebrow" }}
          />
        </div>
        <RtSlot
          as="h1"
          variant="inline"
          manifest={manifest}
          value={block.headline}
          onChange={set("headline")}
          className="cms-block__title"
          placeholder="Headline"
          elementPath={{ blockIndex: idx, field: "headline" }}
        />
        <RtSlot
          as="div"
          variant="block"
          manifest={manifest}
          value={block.subheadline}
          onChange={set("subheadline")}
          className="cms-block__subheadline"
          placeholder="Supporting text"
          elementPath={{ blockIndex: idx, field: "subheadline" }}
        />
        <div className="cms-block__actions">
          <InlineCtaButton
            value={block.cta}
            onChange={set("cta")}
            className="cms-block__primary"
            emptyLabel="Primary action"
            elementPath={{ blockIndex: idx, field: "cta" }}
          />
          <InlineCtaButton
            value={block.secondary}
            onChange={set("secondary")}
            className="cms-block__secondary cms-block__secondary--ghost"
            emptyLabel="Secondary action"
            elementPath={{ blockIndex: idx, field: "secondary" }}
          />
        </div>
      </div>
      {block.foregroundImage ? (
        <figure className="cms-block__mediaHero-foreground">
          <InlineImage
            value={block.foregroundImage}
            onChange={set("foregroundImage")}
            chrome="overlay"
            elementPath={{ blockIndex: idx, field: "foregroundImage" }}
          />
        </figure>
      ) : null}
    </section>
  )
}

export const InfoCardListCanvas: React.FC<CanvasBlockRendererProps> = ({
  block,
  isActive,
  manifest,
  onActivate,
  onUpdate,
}) => {
  const set = setField(block, onUpdate)
  const idx = block.__index as number
  const layout = block.layout ?? "grid"
  const iconPosition = block.iconPosition ?? "top"
  const items: any[] = block.items ?? []

  return (
    <section
      id={block.anchor || undefined}
      className={`cms-block cms-block--infoCardList cms-block--infoCardList-${layout} cms-block--infoCardList-icon-${iconPosition} ${sourceVariantClassName(block)}`.trim()}
      data-source-variant={sourceVariantDataAttribute(block)}
      data-block-index={block.__index ?? undefined}
      data-active={isActive || undefined}
      onClick={onActivate}
    >
      <RtSlot
        as="h2"
        variant="inline"
        manifest={manifest}
        value={block.title}
        onChange={set("title")}
        className="cms-block__title"
        placeholder="Section title"
        elementPath={{ blockIndex: idx, field: "title" }}
      />
      <RtSlot
        as="div"
        variant="block"
        manifest={manifest}
        value={block.intro}
        onChange={set("intro")}
        className="cms-block__intro"
        placeholder="Intro"
        elementPath={{ blockIndex: idx, field: "intro" }}
      />
      <ul className="cms-block__infoCards">
        {items.map((item, i) => (
          <li key={item.id ?? i} className="cms-block__infoCard" data-animation={item.animation && item.animation !== "none" ? item.animation : undefined}>
            <span className="cms-block__infoCard-media">
              {item.image ? (
                <InlineImage
                  value={item.image}
                  onChange={setArrayItemField(block, onUpdate, "items", i, "image")}
                  chrome="overlay"
                  elementPath={{ blockIndex: idx, field: "items", itemIndex: i, subField: "image" }}
                />
              ) : (
                <InlineIcon
                  value={item.icon}
                  onChange={setArrayItemField(block, onUpdate, "items", i, "icon")}
                  elementPath={{ blockIndex: idx, field: "items", itemIndex: i, subField: "icon" }}
                />
              )}
            </span>
            <span className="cms-block__infoCard-body">
              <RtSlot
                as="strong"
                variant="inline"
                manifest={manifest}
                value={item.title}
                onChange={setArrayItemField(block, onUpdate, "items", i, "title")}
                className="cms-block__infoCard-title"
                placeholder="Card title"
                elementPath={{ blockIndex: idx, field: "items", itemIndex: i, subField: "title" }}
              />
              <RtSlot
                as="span"
                variant="block"
                manifest={manifest}
                value={item.description}
                onChange={setArrayItemField(block, onUpdate, "items", i, "description")}
                className="cms-block__infoCard-description"
                placeholder="Card description"
                elementPath={{ blockIndex: idx, field: "items", itemIndex: i, subField: "description" }}
              />
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export const ServiceCarouselCanvas: React.FC<CanvasBlockRendererProps> = ({
  block,
  isActive,
  manifest,
  onActivate,
  onUpdate,
}) => {
  const set = setField(block, onUpdate)
  const idx = block.__index as number
  const layout = block.layout ?? "carousel"
  const carousel = block.carousel ?? {}
  const items: any[] = block.items ?? []

  return (
    <section
      id={block.anchor || undefined}
      className={`cms-block cms-block--serviceCarousel cms-block--serviceCarousel-${layout} ${sourceVariantClassName(block)}`.trim()}
      data-source-variant={sourceVariantDataAttribute(block)}
      data-block-index={block.__index ?? undefined}
      data-active={isActive || undefined}
      data-autoplay={carousel.autoplay ? "true" : undefined}
      data-loop={carousel.loop ? "true" : undefined}
      data-siab-service-carousel={layout === "carousel" ? "true" : undefined}
      onClick={onActivate}
    >
      <RtSlot
        as="h2"
        variant="inline"
        manifest={manifest}
        value={block.title}
        onChange={set("title")}
        className="cms-block__title"
        placeholder="Section title"
        elementPath={{ blockIndex: idx, field: "title" }}
      />
      <RtSlot
        as="div"
        variant="block"
        manifest={manifest}
        value={block.intro}
        onChange={set("intro")}
        className="cms-block__intro"
        placeholder="Intro"
        elementPath={{ blockIndex: idx, field: "intro" }}
      />
      <div className="cms-block__serviceTrack" data-pagination={carousel.pagination ?? "none"} data-siab-service-track="true">
        {items.map((item, i) => (
          <article key={item.id ?? i} className="cms-block__serviceCard">
            <InlineImage
              value={item.image}
              onChange={setArrayItemField(block, onUpdate, "items", i, "image")}
              className="cms-block__serviceImage"
              chrome="overlay"
              elementPath={{ blockIndex: idx, field: "items", itemIndex: i, subField: "image" }}
            />
            <div className="cms-block__serviceBody">
              <RtSlot
                as="h3"
                variant="inline"
                manifest={manifest}
                value={item.title}
                onChange={setArrayItemField(block, onUpdate, "items", i, "title")}
                className="cms-block__serviceTitle"
                placeholder="Service title"
                elementPath={{ blockIndex: idx, field: "items", itemIndex: i, subField: "title" }}
              />
              <RtSlot
                as="div"
                variant="block"
                manifest={manifest}
                value={item.description}
                onChange={setArrayItemField(block, onUpdate, "items", i, "description")}
                className="cms-block__serviceDescription"
                placeholder="Service description"
                elementPath={{ blockIndex: idx, field: "items", itemIndex: i, subField: "description" }}
              />
              <InlineCtaButton
                value={item.cta}
                onChange={setArrayItemField(block, onUpdate, "items", i, "cta")}
                className="cms-block__serviceCta"
                emptyLabel="Service action"
                elementPath={{ blockIndex: idx, field: "items", itemIndex: i, subField: "cta" }}
              />
            </div>
          </article>
        ))}
      </div>
      {layout === "carousel" && carousel.pagination && carousel.pagination !== "none" ? (
        <div className="cms-block__servicePagination" aria-hidden="true">
          {carousel.pagination === "fraction"
            ? <span>1 / {items.length}</span>
            : items.map((_, i) => <span key={i} className={i === 0 ? "is-active" : undefined} />)}
        </div>
      ) : null}
    </section>
  )
}

export const BeforeAfterGalleryCanvas: React.FC<CanvasBlockRendererProps> = ({
  block,
  isActive,
  manifest,
  onActivate,
  onUpdate,
}) => {
  const set = setField(block, onUpdate)
  const idx = block.__index as number
  const pairs: any[] = block.pairs ?? []

  return (
    <section
      id={block.anchor || undefined}
      className={`cms-block cms-block--beforeAfterGallery ${sourceVariantClassName(block)}`.trim()}
      data-source-variant={sourceVariantDataAttribute(block)}
      data-block-index={block.__index ?? undefined}
      data-active={isActive || undefined}
      onClick={onActivate}
    >
      <RtSlot
        as="h2"
        variant="inline"
        manifest={manifest}
        value={block.title}
        onChange={set("title")}
        className="cms-block__title"
        placeholder="Section title"
        elementPath={{ blockIndex: idx, field: "title" }}
      />
      <RtSlot
        as="div"
        variant="block"
        manifest={manifest}
        value={block.intro}
        onChange={set("intro")}
        className="cms-block__intro"
        placeholder="Intro"
        elementPath={{ blockIndex: idx, field: "intro" }}
      />
      <div className="cms-block__comparisonGrid">
        {pairs.map((pair, i) => {
          const ratio = Math.max(5, Math.min(95, Math.round((pair.initialRatio ?? 0.5) * 100)))
          const orientation = pair.orientation ?? "horizontal"
          return (
            <figure
              key={pair.id ?? i}
              className={`cms-block__comparison cms-block__comparison-${orientation}`}
              data-siab-before-after-pair="true"
              data-initial-ratio={ratio}
              data-orientation={orientation}
            >
              <div className="cms-block__comparisonFrame">
                <InlineImage
                  value={pair.before}
                  onChange={setArrayItemField(block, onUpdate, "pairs", i, "before")}
                  className="cms-block__comparisonImage"
                  chrome="overlay"
                  elementPath={{ blockIndex: idx, field: "pairs", itemIndex: i, subField: "before" }}
                />
                <div className="cms-block__comparisonAfter" aria-hidden="true">
                  <InlineImage
                    value={pair.after}
                    onChange={setArrayItemField(block, onUpdate, "pairs", i, "after")}
                    chrome="overlay"
                    elementPath={{ blockIndex: idx, field: "pairs", itemIndex: i, subField: "after" }}
                  />
                </div>
                <span className="cms-block__comparisonLabel cms-block__comparisonLabel-before">{pair.beforeLabel ?? "Before"}</span>
                <span className="cms-block__comparisonLabel cms-block__comparisonLabel-after">{pair.afterLabel ?? "After"}</span>
                <span className="cms-block__comparisonHandle" aria-hidden="true" />
              </div>
              <RtSlot
                as="figcaption"
                variant="block"
                manifest={manifest}
                value={pair.caption}
                onChange={setArrayItemField(block, onUpdate, "pairs", i, "caption")}
                className="cms-block__comparisonCaption"
                placeholder="Caption"
                elementPath={{ blockIndex: idx, field: "pairs", itemIndex: i, subField: "caption" }}
              />
            </figure>
          )
        })}
      </div>
    </section>
  )
}

export const ContactDetailsCanvas: React.FC<CanvasBlockRendererProps> = ({
  block,
  isActive,
  manifest,
  onActivate,
  onUpdate,
}) => {
  const set = setField(block, onUpdate)
  const idx = block.__index as number
  const layout = block.layout ?? "cards"
  const items: any[] = block.items ?? []
  const legal = block.legal ?? {}

  return (
    <section
      id={block.anchor || undefined}
      className={`cms-block cms-block--contactDetails cms-block--contactDetails-${layout} ${sourceVariantClassName(block)}`.trim()}
      data-source-variant={sourceVariantDataAttribute(block)}
      data-block-index={block.__index ?? undefined}
      data-active={isActive || undefined}
      onClick={onActivate}
    >
      <RtSlot
        as="h2"
        variant="inline"
        manifest={manifest}
        value={block.title}
        onChange={set("title")}
        className="cms-block__title"
        placeholder="Section title"
        elementPath={{ blockIndex: idx, field: "title" }}
      />
      <RtSlot
        as="div"
        variant="block"
        manifest={manifest}
        value={block.intro}
        onChange={set("intro")}
        className="cms-block__intro"
        placeholder="Intro"
        elementPath={{ blockIndex: idx, field: "intro" }}
      />
      <dl className="cms-block__contactDetailsList">
        {items.map((item, i) => (
          <div key={item.id ?? i} className="cms-block__contactDetailsItem" data-kind={item.kind || undefined}>
            <span className="cms-block__contactDetailsIcon">
              {item.image ? (
                <InlineImage
                  value={item.image}
                  onChange={setArrayItemField(block, onUpdate, "items", i, "image")}
                  chrome="overlay"
                  elementPath={{ blockIndex: idx, field: "items", itemIndex: i, subField: "image" }}
                />
              ) : (
                <InlineIcon
                  value={item.icon ?? item.kind}
                  onChange={setArrayItemField(block, onUpdate, "items", i, "icon")}
                  elementPath={{ blockIndex: idx, field: "items", itemIndex: i, subField: "icon" }}
                />
              )}
            </span>
            <dt>{item.label}</dt>
            <dd>
              <RtSlot
                as="span"
                variant="block"
                manifest={manifest}
                value={item.value}
                onChange={setArrayItemField(block, onUpdate, "items", i, "value")}
                className="cms-block__contactDetailsValue"
                placeholder="Contact value"
                elementPath={{ blockIndex: idx, field: "items", itemIndex: i, subField: "value" }}
              />
            </dd>
          </div>
        ))}
        {legal.kvkNumber ? <LegalDetail label="KVK" value={legal.kvkNumber} /> : null}
        {legal.btwId ? <LegalDetail label="BTW" value={legal.btwId} /> : null}
        {legal.iban ? <LegalDetail label="IBAN" value={legal.iban} /> : null}
        {legal.bic ? <LegalDetail label="BIC" value={legal.bic} /> : null}
      </dl>
    </section>
  )
}

function LegalDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="cms-block__contactDetailsItem" data-kind="legal">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
