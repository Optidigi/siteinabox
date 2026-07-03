import * as React from "react"
import { MapPin, Menu, X } from "lucide-react"
import type {
  Block,
  ContactSectionBlock,
  CTABlock,
  FAQBlock,
  FeatureListBlock,
  FooterCompositionColumn,
  FooterCompositionItem,
  FooterCompositionLink,
  HeroBlock,
  MediaRef,
  Page,
  RichTextBlock,
  RtBlock,
  RtRoot,
  SiteSettings,
  TestimonialsBlock,
} from "@siteinabox/contracts"
import type { ThemeTokenSpec } from "@siteinabox/contracts/generation"
import { cn } from "@siteinabox/ui/lib/utils"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../../analytics"
import { resolveBlockAnchor } from "../../blocks/anchors"
import { runtimeVariantDataAttribute } from "../../blocks/variants"
import { resolveIcon } from "../../blocks/icons"
import type { BlockRegistry } from "../../blocks"
import type { MediaResolver, ResolvedMedia } from "../../media"
import { resolveMedia } from "../../media"
import { RichTextRenderer, extractRichText } from "../../rich-text"
import { isRtRoot } from "@siteinabox/contracts/rich-text"
import { PUBLIC_RENDERER_THEME_SCOPE, ThemeStyle, themeMode } from "../../theme"

export type AmicarePageRendererProps = {
  page: Page
  settings: SiteSettings
  theme?: ThemeTokenSpec | null
  registry?: BlockRegistry
  mediaResolver?: MediaResolver
  formAction?: string
  className?: string
  canvasClassName?: string
  canvasAttributes?: React.HTMLAttributes<HTMLDivElement>
  nonce?: string
  includeThemeStyle?: boolean
  includeBehaviorScripts?: boolean
  renderBlock?: AmicareRenderBlock
  renderBlocks?: AmicareRenderBlocks
  renderHeader?: AmicareRenderChrome
  renderFooter?: AmicareRenderChrome
}

export type AmicareRenderBlock = (args: {
  block: Block
  index: number
  defaultRender: React.ReactNode
}) => React.ReactNode

export type AmicareRenderBlocks = (args: {
  blocks: Page["blocks"]
  defaultRenderBlocks: React.ReactNode[]
}) => React.ReactNode

export type AmicareRenderChrome = (args: {
  defaultChrome: React.ReactNode
}) => React.ReactNode

const DEFAULT_NAV_LINKS = [
  { label: "Werkwijze", href: "#werkwijze" },
  { label: "Over", href: "#over" },
  { label: "Wat telt", href: "#wat-telt" },
  { label: "Contact", href: "#contact" },
]

const DEFAULT_BRAND = "Amicare-Zorg"
const DEFAULT_EMAIL = "info@ami-care.nl"
const DEFAULT_TAGLINE = "Jeugdzorg met hart en toewijding."
const DEFAULT_TRADE_NAME = "AMICARE ZORG"
const DEFAULT_KVK_NUMBER = "99968347"
const DEFAULT_ESTABLISHMENT_NUMBER = "000065004922"
const PULL_QUOTE = "Écht verschil maken voor jongeren en gezinnen."

function media(value: MediaRef | undefined, mediaResolver?: MediaResolver): ResolvedMedia | null {
  if (!value) return null
  if (!mediaResolver && typeof value === "object" && !Array.isArray(value)) {
    if (value.url) return { src: value.url, alt: value.alt ?? undefined }
    if (value.filename) return { src: `/media/${value.filename}`, alt: value.alt ?? undefined }
  }
  return resolveMedia(value ?? null, mediaResolver)
}

function mediaUrl(value: MediaRef | undefined, mediaResolver?: MediaResolver): string | null {
  return media(value, mediaResolver)?.src ?? null
}

function mediaAlt(value: MediaRef | undefined, resolved: ResolvedMedia | null): string | null {
  if (resolved?.alt) return resolved.alt
  if (value && typeof value === "object" && !Array.isArray(value)) return value.alt ?? null
  return null
}

function linkKey(link: FooterCompositionLink, index: number) {
  return `${link.label ?? "link"}-${link.href ?? index}`
}

function itemLabel(item: FooterCompositionItem, fallback: string) {
  return item.label?.trim() || fallback
}

function AmicareNav({
  settings,
  mediaResolver,
}: {
  settings: SiteSettings
  mediaResolver?: MediaResolver
}) {
  const brand = settings.siteName?.trim() || DEFAULT_BRAND
  const logo = media(settings.chrome?.header?.logo ?? settings.branding?.logo ?? null, mediaResolver)
  const links = settings.navHeader && settings.navHeader.length > 0 ? settings.navHeader : DEFAULT_NAV_LINKS
  const toggleId = "amicare-mobile-menu-toggle"

  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="sticky top-0 z-50 flex w-full items-center justify-between border-b border-rule bg-bg/80 px-6 py-5 backdrop-blur-lg @min-[48rem]/site-frame:px-12 @min-[64rem]/site-frame:px-20"
      data-amicare-nav
    >
      <a href="#top" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
        {logo ? (
          <>
            <img src={logo.src} alt="" className="h-7 w-auto max-w-40 object-contain" />
            <span className="sr-only">{brand}</span>
          </>
        ) : (
          <>
            <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-accent" />
            <span className="font-sans text-[13px] font-medium uppercase tracking-[0.18em]">{brand}</span>
          </>
        )}
      </a>

      <div className="hidden items-center gap-8 text-[13px] tracking-[0.04em] @min-[48rem]/site-frame:flex">
        {links.map((link) => {
          const id = link.href.replace(/^#/, "")
          return (
            <a
              key={id}
              href={link.href}
              className="relative text-ink-muted transition-colors hover:text-ink"
              data-amicare-nav-link={id}
            >
              {link.label}
              <span
                aria-hidden="true"
                className="absolute -bottom-1 left-0 right-0 hidden h-[2px] rounded-full bg-accent"
                data-amicare-nav-indicator={id}
              />
            </a>
          )
        })}
      </div>

      <input id={toggleId} className="peer sr-only" type="checkbox" aria-label="Menu openen" />
      <label
        htmlFor={toggleId}
        aria-label="Menu openen"
        className="rounded-full bg-accent/10 p-2 text-ink transition-colors hover:bg-accent/20 @min-[48rem]/site-frame:hidden"
      >
        <Menu className="block peer-checked:hidden" size={20} aria-hidden />
        <X className="hidden peer-checked:block" size={20} aria-hidden />
      </label>

      <div className="absolute right-4 left-4 top-full z-50 mt-2 hidden w-[calc(100%-2rem)] flex-col gap-5 rounded-2xl border border-rule bg-card p-6 shadow-2xl peer-checked:flex @min-[48rem]/site-frame:hidden">
        {links.map((link) => {
          const id = link.href.replace(/^#/, "")
          return (
            <a
              key={id}
              href={link.href}
              className="text-[15px] tracking-[0.04em] text-ink-muted"
              data-amicare-nav-link={id}
            >
              {link.label}
            </a>
          )
        })}
      </div>
    </nav>
  )
}

function AmicareMaintenanceBanner({ settings }: { settings: SiteSettings }) {
  if (!settings.maintenance?.enabled) return null
  const message = settings.maintenance.message?.trim() || "Deze website is tijdelijk in onderhoud."
  return (
    <aside className="border-b border-rule bg-accent/10 px-6 py-3 text-center text-[13px] font-medium tracking-[0.02em] text-ink @min-[48rem]/site-frame:px-12 @min-[64rem]/site-frame:px-20">
      {message}
    </aside>
  )
}

function AmicareFooter({
  settings,
  mediaResolver,
}: {
  settings: SiteSettings
  mediaResolver?: MediaResolver
}) {
  const year = new Date().getFullYear()
  const footer = settings.chrome?.footer
  const logo = media(footer?.logo ?? settings.branding?.logo ?? null, mediaResolver)
  const footerBrand = settings.siteName?.trim() || DEFAULT_BRAND
  const footerEmail = settings.contactEmail?.trim() || DEFAULT_EMAIL
  const footerTagline = footer?.tagline?.trim() || DEFAULT_TAGLINE
  const footerTradeName = settings.nap?.legalName?.trim() || DEFAULT_TRADE_NAME
  const footerKvkNumber = settings.nap?.kvkNumber?.trim() || DEFAULT_KVK_NUMBER
  const footerEstablishmentNumber = settings.nap?.establishmentNumber?.trim() || DEFAULT_ESTABLISHMENT_NUMBER
  const copyrightText = footer?.copyright?.trim() || `© ${year} ${footerBrand}`
  const columns = Array.isArray(footer?.columns)
    ? footer.columns.filter((column): column is FooterCompositionColumn => Array.isArray(column?.items))
    : []
  const navLinks = Array.isArray(settings.navFooter)
    ? settings.navFooter.filter((link) => link.label?.trim() && link.href?.trim())
    : []
  const gridClass =
    columns.length === 1
      ? "@min-[48rem]/site-frame:grid-cols-1"
      : columns.length === 2
        ? "@min-[48rem]/site-frame:grid-cols-2"
        : columns.length === 4
          ? "@min-[48rem]/site-frame:grid-cols-4"
          : columns.length === 5
            ? "@min-[48rem]/site-frame:grid-cols-5"
            : columns.length === 6
              ? "@min-[48rem]/site-frame:grid-cols-6"
              : "@min-[48rem]/site-frame:grid-cols-3"

  const brandMark = (
    <div className="flex items-center gap-2.5">
      {logo ? (
        <img src={logo.src} alt="" className="h-8 w-auto max-w-44 object-contain" />
      ) : (
        <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-accent" />
      )}
      <span className="font-sans text-[14px] font-medium uppercase tracking-[0.18em] text-ink">{footerBrand}</span>
    </div>
  )

  const business = (
    <div className="space-y-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">Bedrijfsgegevens</p>
      <div className="space-y-1.5 text-[13px] leading-[1.6] text-ink-muted">
        <p>Handelsnaam: <span className="text-ink">{footerTradeName}</span></p>
        <p>KVK <span className="text-ink">{footerKvkNumber}</span></p>
        <p>Vestigingsnr. <span className="text-ink">{footerEstablishmentNumber}</span></p>
      </div>
    </div>
  )

  const contact = (
    <div className="space-y-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">Contact</p>
      <div className="space-y-1.5 text-[13px] leading-[1.6] text-ink-muted">
        <p className="pt-1.5">
          <a href={`mailto:${footerEmail}`} className="text-ink transition-colors hover:text-accent">{footerEmail}</a>
        </p>
      </div>
    </div>
  )

  return (
    <footer className="relative border-t border-rule bg-gradient-to-br from-secondary/20 via-bg to-accent/5 px-6 py-16 @min-[48rem]/site-frame:px-12 @min-[64rem]/site-frame:px-24">
      {columns.length > 0 ? (
        <div className={cn("mx-auto grid max-w-7xl grid-cols-1 gap-12 @min-[48rem]/site-frame:gap-8 @min-[64rem]/site-frame:gap-12", gridClass)}>
          {columns.map((column, columnIndex) => (
            <div key={column.id ?? columnIndex} className="space-y-6">
              {(column.items ?? []).map((item, itemIndex) => (
                <React.Fragment key={item.id ?? itemIndex}>
                  {item.type === "brand" && (
                    <div className="space-y-3">
                      {brandMark}
                      {(item.text?.trim() || footerTagline) && (
                        <p className="max-w-[28ch] font-serif text-[14px] italic leading-[1.5] text-ink-muted">
                          {item.text?.trim() || footerTagline}
                        </p>
                      )}
                    </div>
                  )}
                  {item.type === "business" && business}
                  {item.type === "contact" && contact}
                  {item.type === "text" && item.text?.trim() && (
                    <div className="space-y-3">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">{itemLabel(item, "Info")}</p>
                      <p className="max-w-[28ch] text-[13px] leading-[1.6] text-ink-muted">{item.text.trim()}</p>
                    </div>
                  )}
                  {item.type === "links" && (item.links ?? []).some((link) => link.label?.trim() && link.href?.trim()) && (
                    <div className="space-y-3">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">{itemLabel(item, "Links")}</p>
                      <ul className="space-y-1.5 text-[13px] leading-[1.6] text-ink-muted">
                        {(item.links ?? []).filter((link) => link.label?.trim() && link.href?.trim()).map((link, index) => (
                          <li key={linkKey(link, index)}>
                            <a href={link.href ?? undefined} className="text-ink transition-colors hover:text-accent">{link.label}</a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {item.type === "navigation" && navLinks.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">{itemLabel(item, "Navigatie")}</p>
                      <ul className="space-y-1.5 text-[13px] leading-[1.6] text-ink-muted">
                        {navLinks.map((link, index) => (
                          <li key={linkKey(link, index)}>
                            <a href={link.href} className="text-ink transition-colors hover:text-accent">{link.label}</a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 @min-[48rem]/site-frame:grid-cols-3 @min-[48rem]/site-frame:gap-8 @min-[64rem]/site-frame:gap-12">
          <div className="space-y-3">
            {brandMark}
            <p className="max-w-[28ch] font-serif text-[14px] italic leading-[1.5] text-ink-muted">{footerTagline}</p>
          </div>
          {business}
          {contact}
        </div>
      )}

      <div className="mx-auto my-8 max-w-7xl border-t border-rule" />
      <p className="mx-auto max-w-7xl text-center text-[12px] tracking-[0.04em] text-ink-muted/70 @min-[48rem]/site-frame:text-left">
        {copyrightText}
      </p>
    </footer>
  )
}

function AmicareHero({
  block,
  dataBlockIndex,
  mediaResolver,
}: {
  block: HeroBlock
  dataBlockIndex: number
  mediaResolver?: MediaResolver
}) {
  const ctaLabel = block.cta?.label?.trim()
  const ctaHref = block.cta?.href?.trim()
  const image = media(block.image, mediaResolver)
  const eyebrowText = extractRichText(block.eyebrow)
  const sourceVariant = runtimeVariantDataAttribute(block, { legacyTenant: "amicare" })

  return (
    <section
      id={resolveBlockAnchor(block, { legacyTenant: "amicare", surface: "live" })}
      className="cms-block cms-block--hero relative flex min-h-[90vh] flex-col items-center overflow-hidden px-6 py-12 @min-[48rem]/site-frame:flex-row @min-[48rem]/site-frame:px-12 @min-[64rem]/site-frame:px-24"
      data-source-variant={sourceVariant}
      data-block-index={dataBlockIndex}
      {...sectionAnalyticsAttrs(block.analytics, "hero", dataBlockIndex)}
    >
      <div aria-hidden="true" className="amicare-hero-glow amicare-hero-glow--start pointer-events-none absolute -left-[10%] -top-[10%] -z-10 h-[500px] w-[500px] rounded-full blur-3xl" />
      <div aria-hidden="true" className="amicare-hero-glow amicare-hero-glow--end pointer-events-none absolute -bottom-[10%] -right-[5%] -z-10 h-[400px] w-[400px] rounded-full blur-3xl" />

      <div className="relative z-10 w-full space-y-7 @min-[48rem]/site-frame:w-1/2">
        {eyebrowText && (
          <span className="inline-block -rotate-2 animate-fade-up text-[22px] text-accent [animation-delay:0ms] [font-family:var(--font-script)]">
            {eyebrowText}
          </span>
        )}
        <h1
          className="font-serif text-[44px] font-normal leading-[1.05] tracking-[-0.01em] @min-[48rem]/site-frame:text-[60px] @min-[64rem]/site-frame:text-[76px] animate-fade-up [animation-delay:50ms] [overflow-wrap:anywhere] [&_em]:relative [&_em]:not-italic [&_em]:inline-block [&_em]:whitespace-nowrap [&_em]:italic [&_em]:text-accent"
          style={{ maxWidth: "14ch", fontFamily: "var(--font-title)" }}
        >
          <RichTextRenderer value={block.headline} />
        </h1>
        {block.subheadline && (
          <p className="max-w-md animate-fade-up text-[17px] leading-[1.6] text-ink-muted [animation-delay:150ms] [font-family:var(--font-text)] @min-[48rem]/site-frame:text-[18px]">
            <RichTextRenderer value={block.subheadline} blockMode="inline" />
          </p>
        )}
        {block.pills && block.pills.length > 0 && (
          <div className="flex animate-fade flex-wrap gap-2 pt-2 [animation-delay:300ms]">
            {block.pills.map((pill, index) => (
              <span key={pill.id ?? index} className="rounded-md border border-rule bg-secondary/40 px-3 py-1.5 text-[12px] font-medium text-ink-muted [font-family:var(--font-text)]">
                {pill.label}
              </span>
            ))}
          </div>
        )}
        {ctaLabel && ctaHref && (
          <a
            href={ctaHref}
            className="amicare-button-primary inline-block animate-fade-up rounded-md bg-accent px-6 py-3 text-[14px] font-medium shadow-sm transition-colors [animation-delay:400ms] [font-family:var(--font-text)] hover:bg-accent/90"
            {...actionAnalyticsAttrs("primary", ctaLabel)}
          >
            {ctaLabel}
          </a>
        )}
      </div>

      <div className="relative mt-14 w-full @min-[48rem]/site-frame:mt-0 @min-[48rem]/site-frame:w-1/2">
        {image && (
          <div className="relative z-10 animate-fade [animation-delay:100ms]">
            <img
              src={image.src}
              alt={mediaAlt(block.image, image) ?? ""}
              loading="eager"
              decoding="async"
              className="aspect-[4/5] w-full rotate-0 transform rounded-[var(--radius-lg)] object-cover shadow-2xl @min-[48rem]/site-frame:aspect-[4/3] @min-[48rem]/site-frame:rotate-3"
            />
            <figure className="absolute -bottom-8 -left-2 max-w-[230px] animate-float rounded-lg border border-rule bg-card p-4 shadow-lg [animation-delay:0ms] @min-[48rem]/site-frame:-bottom-10 @min-[48rem]/site-frame:-left-8 @min-[48rem]/site-frame:p-5">
              <span aria-hidden="true" className="mr-1 align-top text-3xl italic leading-none text-accent [font-family:var(--font-serif)]">&ldquo;</span>
              <blockquote className="inline font-serif text-[17px] italic leading-[1.35] text-ink @min-[48rem]/site-frame:text-[19px]">{PULL_QUOTE}</blockquote>
            </figure>
            <div className="absolute -top-6 -right-2 flex max-w-[200px] animate-float items-center gap-3 rounded-lg border border-rule bg-card p-3 shadow-lg [animation-delay:500ms] @min-[48rem]/site-frame:-top-8 @min-[48rem]/site-frame:-right-8 @min-[48rem]/site-frame:p-4">
              <span className="rounded-full bg-accent/10 p-2 text-accent">
                <MapPin size={18} aria-hidden />
              </span>
              <div className="text-[12px] leading-tight">
                <p className="font-serif text-[14px] italic text-ink">Roermond e.o.</p>
                <p className="text-ink-muted">Limburg-Noord</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function AmicareFeatureList({ block, dataBlockIndex }: { block: FeatureListBlock; dataBlockIndex: number }) {
  if (!block.features || block.features.length === 0) return null
  const introText = extractRichText(block.intro)
  const sourceVariant = runtimeVariantDataAttribute(block, { legacyTenant: "amicare" })

  return (
    <section
      id={resolveBlockAnchor(block, { legacyTenant: "amicare", surface: "live" })}
      className="cms-block cms-block--featurelist cms-block--source-amicare-care-cards relative bg-card/50 px-6 py-20 @min-[48rem]/site-frame:px-12 @min-[48rem]/site-frame:py-24 @min-[64rem]/site-frame:px-24"
      data-source-variant={sourceVariant}
      data-block-index={dataBlockIndex}
      {...sectionAnalyticsAttrs(block.analytics, "featureList", dataBlockIndex)}
    >
      <div className="mx-auto max-w-7xl">
        {(block.title || introText) && (
          <div className="mb-14 space-y-3 text-center">
            {introText && (
              <span className="cms-block__intro inline-block -rotate-2 text-[20px] text-accent [font-family:var(--font-script)]">{introText}</span>
            )}
            {block.title && (
              <h2
                className="cms-block__title font-serif text-[34px] leading-[1.1] tracking-[-0.01em] @min-[48rem]/site-frame:text-[44px] [&_em]:not-italic [&_em]:italic [&_em]:text-accent"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                <RichTextRenderer value={block.title} />
              </h2>
            )}
          </div>
        )}

        <div className="cms-block__features grid grid-cols-1 gap-8 @min-[48rem]/site-frame:grid-cols-3">
          {block.features.map((feature, index) => {
            const Icon = resolveIcon(feature.icon)
            return (
              <article key={index} className="cms-block__feature overflow-hidden rounded-lg border border-rule bg-card shadow-lg">
                <div className="cms-block__feature-icon flex h-32 items-center justify-center bg-accent/[0.08]">
                  {Icon && <Icon size={44} className="text-accent" strokeWidth={1.5} aria-hidden />}
                </div>
                <div className="space-y-3 p-7 text-center">
                  <h3 className="cms-block__feature-title font-serif text-[24px] leading-[1.2] [font-family:var(--font-heading)]">
                    <RichTextRenderer value={feature.title} />
                  </h3>
                  {feature.description && (
                    <p className="cms-block__feature-description text-[16px] leading-[1.6] text-ink-muted [font-family:var(--font-text)]">
                      <RichTextRenderer value={feature.description} blockMode="inline" />
                    </p>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function splitAmicareIntro(value: unknown): { intro: RtRoot; body: RtRoot } | null {
  if (!isRtRoot(value) || value.variant !== "block") return null
  const [eyebrow, heading, ...rest] = value.children
  if (eyebrow?.t !== "themed" || eyebrow.id !== "eyebrow" || heading?.t !== "heading") return null
  return {
    intro: {
      t: "root",
      variant: "block",
      children: [eyebrow, heading] as RtBlock[],
    },
    body: {
      t: "root",
      variant: "block",
      children: rest as RtBlock[],
    },
  }
}

function AmicareRichText({ block, dataBlockIndex }: { block: RichTextBlock; dataBlockIndex: number }) {
  if (!block.body) return null
  const splitBody = splitAmicareIntro(block.body)
  const sourceVariant = runtimeVariantDataAttribute(block, { legacyTenant: "amicare" })
  return (
    <section
      id={resolveBlockAnchor(block, { legacyTenant: "amicare", surface: "live" })}
      className="cms-block cms-block--richtext px-6 py-20 @min-[48rem]/site-frame:px-12 @min-[48rem]/site-frame:py-24 @min-[64rem]/site-frame:px-24"
      data-source-variant={sourceVariant}
      data-block-index={dataBlockIndex}
      {...sectionAnalyticsAttrs(block.analytics, "richText", dataBlockIndex)}
    >
      {splitBody ? (
        <>
          <div className="amicare-richtext-intro mx-auto max-w-3xl text-center">
            <RichTextRenderer value={splitBody.intro} />
          </div>
          {splitBody.body.children.length > 0 && (
            <div
              className="amicare-richtext-body prose mx-auto mt-10 max-w-prose space-y-6 text-[17px] leading-[1.6] text-ink/90 @min-[48rem]/site-frame:text-[18px]"
              style={{ fontFamily: "var(--font-text)" }}
            >
              <RichTextRenderer value={splitBody.body} />
            </div>
          )}
        </>
      ) : (
      <div
        className="prose mx-auto max-w-prose text-[17px] leading-[1.7] text-ink/90 @min-[48rem]/site-frame:text-[18px] prose-headings:font-serif prose-headings:tracking-[-0.01em] prose-headings:text-ink prose-h2:text-[34px] prose-h2:leading-[1.1] @min-[48rem]/site-frame:prose-h2:text-[44px] prose-p:text-ink/90 prose-strong:text-ink prose-strong:font-semibold prose-em:text-accent prose-em:italic prose-a:text-accent prose-a:underline prose-a:decoration-1 prose-a:underline-offset-[6px] hover:prose-a:decoration-accent prose-blockquote:border-l-2 prose-blockquote:border-accent prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:font-serif prose-blockquote:text-[19px] @min-[48rem]/site-frame:prose-blockquote:text-[22px]"
        style={{ fontFamily: "var(--font-text)" }}
      >
        <RichTextRenderer value={block.body} />
      </div>
      )}
    </section>
  )
}

function AmicareCTA({
  block,
  dataBlockIndex,
  mediaResolver,
}: {
  block: CTABlock
  dataBlockIndex: number
  mediaResolver?: MediaResolver
}) {
  const eyebrowText = extractRichText(block.eyebrow)
  const descriptionText = extractRichText(block.description)
  const primaryLabel = block.primary?.label?.trim()
  const primaryHref = block.primary?.href?.trim()
  const secondaryLabel = block.secondary?.label?.trim()
  const secondaryHref = block.secondary?.href?.trim()
  const isContact = primaryHref?.startsWith("mailto:") || primaryHref?.startsWith("tel:")
  const backgroundImageUrl = mediaUrl(block.backgroundImage, mediaResolver)
  const sectionId = resolveBlockAnchor(block, { legacyTenant: "amicare", surface: "live" })
  const sourceVariant = runtimeVariantDataAttribute(block, { legacyTenant: "amicare" })

  return (
    <section
      id={sectionId}
      className={
        isContact
          ? "cms-block cms-block--cta cms-block--cta-contact relative isolate overflow-hidden border-t border-rule px-6 py-24 @min-[48rem]/site-frame:px-12 @min-[48rem]/site-frame:py-28 @min-[64rem]/site-frame:px-24"
          : "cms-block cms-block--cta cms-block--cta-quote relative isolate overflow-hidden bg-secondary/40 px-6 py-24 @min-[48rem]/site-frame:px-12 @min-[48rem]/site-frame:py-28"
      }
      data-source-variant={sourceVariant}
      data-block-index={dataBlockIndex}
      {...sectionAnalyticsAttrs(block.analytics, "cta", dataBlockIndex)}
    >
      {backgroundImageUrl && (
        <img aria-hidden="true" src={backgroundImageUrl} alt="" loading="lazy" decoding="async" className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.12]" />
      )}
      {(!isContact || backgroundImageUrl) && (
        <div aria-hidden="true" className="amicare-quote-overlay pointer-events-none absolute inset-0 -z-10" />
      )}
      {!isContact && <div aria-hidden="true" className="amicare-quote-glow pointer-events-none absolute -bottom-[20%] -right-[10%] -z-10 h-[300px] w-[300px] rounded-full blur-3xl" />}

      <div className={isContact ? "mx-auto max-w-3xl space-y-8 text-center" : "mx-auto max-w-3xl text-center"}>
        {eyebrowText && <span className="inline-block -rotate-2 text-[20px] text-accent [font-family:var(--font-script)]">{eyebrowText}</span>}
        {isContact ? (
          <h2
            className="mx-auto max-w-[24ch] font-serif text-[28px] leading-[1.25] tracking-[-0.005em] text-ink-muted @min-[48rem]/site-frame:text-[36px]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <RichTextRenderer value={block.headline} />
          </h2>
        ) : (
          <h3
            className="mt-5 font-serif text-[32px] italic leading-[1.2] tracking-[-0.005em] text-ink @min-[48rem]/site-frame:text-[48px]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            &ldquo;<RichTextRenderer value={block.headline} />&rdquo;
          </h3>
        )}
        {descriptionText && (
          <p className="mx-auto mt-7 max-w-prose text-[16px] leading-[1.7] text-ink-muted [font-family:var(--font-text)] @min-[48rem]/site-frame:text-[17px]">
            <RichTextRenderer value={block.description} blockMode="inline" />
          </p>
        )}
        {(primaryLabel && primaryHref) || (secondaryLabel && secondaryHref) ? (
          <div className={isContact ? "space-y-4" : "mt-6 flex flex-wrap items-center justify-center gap-3"}>
            {primaryLabel && primaryHref && (
              <a
                href={primaryHref}
                className={
                  isContact
                    ? "inline-block font-serif text-[28px] text-ink underline decoration-1 underline-offset-[8px] transition-colors [font-family:var(--font-heading)] hover:text-accent hover:decoration-accent @min-[48rem]/site-frame:text-[44px]"
                    : "inline-block rounded-md border border-rule px-6 py-3 text-[14px] font-medium text-ink transition-colors [font-family:var(--font-text)] hover:border-accent hover:text-accent"
                }
                {...actionAnalyticsAttrs("primary", primaryLabel)}
              >
                {primaryLabel}
              </a>
            )}
            {secondaryLabel && secondaryHref && (
              <a
                href={secondaryHref}
                className="inline-block rounded-md border border-rule px-6 py-3 text-[14px] font-medium text-ink transition-colors [font-family:var(--font-text)] hover:border-accent hover:text-accent"
                {...actionAnalyticsAttrs("secondary", secondaryLabel)}
              >
                {secondaryLabel}
              </a>
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function AmicareTestimonials({
  block,
  dataBlockIndex,
  mediaResolver,
}: {
  block: TestimonialsBlock
  dataBlockIndex: number
  mediaResolver?: MediaResolver
}) {
  if (!block.items || block.items.length === 0) return null
  const sourceVariant = runtimeVariantDataAttribute(block, { legacyTenant: "amicare" })
  return (
    <section
      id={block.anchor ?? undefined}
      className="cms-block cms-block--testimonials bg-secondary/40 px-6 py-16 @min-[48rem]/site-frame:px-12 @min-[48rem]/site-frame:py-20"
      data-source-variant={sourceVariant}
      data-block-index={dataBlockIndex}
      {...sectionAnalyticsAttrs(block.analytics, "testimonials", dataBlockIndex)}
    >
      <div className="container mx-auto">
        {block.title && (
          <h2 className="mb-12 text-center font-serif text-[34px] leading-[1.1] tracking-[0] [font-family:var(--font-heading)] @min-[48rem]/site-frame:text-[44px]">
            {block.title}
          </h2>
        )}
        <div className="grid gap-6 @min-[48rem]/site-frame:grid-cols-2 @min-[64rem]/site-frame:grid-cols-3">
          {block.items.map((item, index) => {
            const avatar = media(item.avatar, mediaResolver)
            return (
              <figure key={index} className="flex flex-col rounded-lg border border-rule bg-card p-6">
                <blockquote className="flex-1 font-serif text-[17px] italic leading-[1.5] text-ink [font-family:var(--font-heading)]">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-4 flex items-center gap-3">
                  {avatar && <img src={avatar.src} alt="" className="h-10 w-10 rounded-full object-cover" loading="lazy" decoding="async" />}
                  <div>
                    <div className="font-medium text-ink [font-family:var(--font-text)]">{item.author}</div>
                    {item.role && <div className="text-sm text-ink-muted [font-family:var(--font-text)]">{item.role}</div>}
                  </div>
                </figcaption>
              </figure>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function AmicareFAQ({ block, dataBlockIndex }: { block: FAQBlock; dataBlockIndex: number }) {
  if (!block.items || block.items.length === 0) return null
  const sourceVariant = runtimeVariantDataAttribute(block, { legacyTenant: "amicare" })
  return (
    <section
      id={block.anchor ?? undefined}
      className="cms-block cms-block--faq px-6 py-16 @min-[48rem]/site-frame:px-12 @min-[48rem]/site-frame:py-20 @min-[64rem]/site-frame:px-24"
      data-source-variant={sourceVariant}
      data-block-index={dataBlockIndex}
      {...sectionAnalyticsAttrs(block.analytics, "faq", dataBlockIndex)}
    >
      <div className="container mx-auto max-w-3xl">
        {block.title && (
          <h2 className="mb-10 text-center font-serif text-[34px] leading-[1.1] tracking-[0] [font-family:var(--font-heading)] @min-[48rem]/site-frame:text-[44px]">
            <RichTextRenderer value={block.title} />
          </h2>
        )}
        <dl className="space-y-4">
          {block.items.map((item, index) => (
            <details key={index} className="group rounded-lg border border-rule bg-card p-4">
              <summary className="flex list-none cursor-pointer items-center justify-between font-medium text-ink [font-family:var(--font-heading)]">
                <span><RichTextRenderer value={item.question} /></span>
                <span className="text-ink-muted transition-transform group-open:rotate-180" aria-hidden>▾</span>
              </summary>
              <div className="mt-3 text-sm leading-relaxed text-ink-muted [font-family:var(--font-text)]">
                <RichTextRenderer value={item.answer} />
              </div>
            </details>
          ))}
        </dl>
      </div>
    </section>
  )
}

function AmicareContactSection({
  block,
  dataBlockIndex,
  formAction,
}: {
  block: ContactSectionBlock
  dataBlockIndex: number
  formAction?: string
}) {
  if (!block.fields || block.fields.length === 0) return null
  const sourceVariant = runtimeVariantDataAttribute(block, { legacyTenant: "amicare" })
  return (
    <section
      id={block.anchor ?? undefined}
      className="cms-block cms-block--contact px-6 py-16 @min-[48rem]/site-frame:px-12 @min-[48rem]/site-frame:py-20"
      data-source-variant={sourceVariant}
      data-block-index={dataBlockIndex}
      {...sectionAnalyticsAttrs(block.analytics, "contactSection", dataBlockIndex)}
    >
      <div className="container mx-auto max-w-2xl">
        {block.title && (
          <h2
            className="font-serif text-[34px] leading-[1.1] tracking-[-0.01em] @min-[48rem]/site-frame:text-[44px]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <RichTextRenderer value={block.title} />
          </h2>
        )}
        {block.description && (
          <p className="mt-3 text-[17px] leading-[1.6] text-ink-muted [font-family:var(--font-text)] @min-[48rem]/site-frame:text-[18px]">
            <RichTextRenderer value={block.description} blockMode="inline" />
          </p>
        )}
        <form
          name={block.formName}
          method="POST"
          action={formAction || "/api/forms"}
          className="mt-8 space-y-4"
          data-siab-analytics-form="true"
          data-siab-form-name={block.formName}
        >
          <input type="hidden" name="formName" value={block.formName} />
          {block.fields.map((field) => (
            <div key={field.name} className="space-y-1.5">
              <label htmlFor={`f-${field.name}`} className="block text-sm font-medium text-ink">
                {field.label}
                {field.required && <span className="text-accent"> *</span>}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  id={`f-${field.name}`}
                  name={field.name}
                  required={!!field.required}
                  rows={5}
                  className="w-full rounded-md border border-rule bg-card px-3 py-2 text-sm text-ink [font-family:var(--font-text)] focus:outline-none focus:ring-2 focus:ring-accent"
                />
              ) : (
                <input
                  id={`f-${field.name}`}
                  name={field.name}
                  type={field.type}
                  required={!!field.required}
                  className="w-full rounded-md border border-rule bg-card px-3 py-2 text-sm text-ink [font-family:var(--font-text)] focus:outline-none focus:ring-2 focus:ring-accent"
                />
              )}
            </div>
          ))}
          <button
            type="submit"
            className="amicare-button-primary rounded-md bg-accent px-6 py-3 text-[14px] font-medium transition-colors [font-family:var(--font-text)] hover:bg-accent/90"
            {...actionAnalyticsAttrs("primary", block.submitLabel ?? "Send")}
          >
            {block.submitLabel ?? "Send"}
          </button>
        </form>
      </div>
    </section>
  )
}

function AmicareBlock({
  block,
  index,
  mediaResolver,
  formAction,
}: {
  block: Block
  index: number
  mediaResolver?: MediaResolver
  formAction?: string
}) {
  switch (block.blockType) {
    case "hero":
      return <AmicareHero block={block} dataBlockIndex={index} mediaResolver={mediaResolver} />
    case "featureList":
      return <AmicareFeatureList block={block} dataBlockIndex={index} />
    case "richText":
      return <AmicareRichText block={block} dataBlockIndex={index} />
    case "cta":
      return <AmicareCTA block={block} dataBlockIndex={index} mediaResolver={mediaResolver} />
    case "testimonials":
      return <AmicareTestimonials block={block} dataBlockIndex={index} mediaResolver={mediaResolver} />
    case "faq":
      return <AmicareFAQ block={block} dataBlockIndex={index} />
    case "contactSection":
      return <AmicareContactSection block={block} dataBlockIndex={index} formAction={formAction} />
    default:
      return null
  }
}

function AmicareCookieConsent({ enabled, nonce }: { enabled: boolean; nonce?: string }) {
  if (!enabled) return null
  const script = `(() => {
  const preferenceKey = "siab_cookie_consent_v1";
  const banner = document.getElementById("cookie-consent-banner");
  const preferences = document.getElementById("cookie-consent-preferences");
  if (!banner || !preferences) return;
  const readPreference = () => {
    try { return window.localStorage.getItem(preferenceKey); } catch { return null; }
  };
  const writePreference = (value) => {
    try { window.localStorage.setItem(preferenceKey, value); } catch {}
  };
  const showBanner = () => {
    banner.classList.remove("hidden");
    preferences.classList.add("hidden");
  };
  const hideBanner = () => {
    banner.classList.add("hidden");
    preferences.classList.remove("hidden");
  };
  const applyPreference = (value) => {
    if (value === "accepted") {
      window.SIABAnalytics?.grantConsent();
      hideBanner();
      return;
    }
    if (value === "declined") {
      window.SIABAnalytics?.revokeConsent();
      hideBanner();
      return;
    }
    showBanner();
  };
  banner.querySelector("[data-cookie-consent-accept]")?.addEventListener("click", () => {
    writePreference("accepted");
    applyPreference("accepted");
  });
  banner.querySelector("[data-cookie-consent-decline]")?.addEventListener("click", () => {
    writePreference("declined");
    applyPreference("declined");
  });
  preferences.addEventListener("click", showBanner);
  applyPreference(readPreference());
})();`

  return (
    <>
      <div
        id="cookie-consent-banner"
        className="fixed inset-x-4 bottom-4 z-[80] hidden max-w-xl rounded-lg border border-rule bg-card p-4 shadow-2xl @min-[48rem]/site-frame:left-6 @min-[48rem]/site-frame:right-auto @min-[48rem]/site-frame:p-5"
        role="dialog"
        aria-live="polite"
        aria-label="Cookie voorkeuren"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="font-serif text-[22px] leading-tight text-ink">Cookies</p>
            <p className="text-[14px] leading-[1.55] text-ink-muted">
              We gebruiken noodzakelijke cookies voor de website. Met uw toestemming meten we anoniem hoe de website wordt gebruikt.
            </p>
          </div>
          <div className="flex flex-col gap-2 @min-[30rem]/site-frame:flex-row">
            <button type="button" className="amicare-button-primary rounded-md bg-accent px-4 py-2.5 text-[14px] font-medium transition-colors hover:bg-accent/90" data-cookie-consent-accept>
              Accepteren
            </button>
            <button type="button" className="rounded-md border border-rule bg-bg px-4 py-2.5 text-[14px] font-medium text-ink transition-colors hover:bg-secondary/40" data-cookie-consent-decline>
              Weigeren
            </button>
          </div>
        </div>
      </div>
      <button
        id="cookie-consent-preferences"
        type="button"
        className="fixed bottom-4 right-4 z-[70] hidden rounded-md border border-rule bg-card px-3 py-2 text-[12px] font-medium text-ink-muted shadow-lg transition-colors hover:text-ink"
      >
        Cookies
      </button>
      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: script }} />
    </>
  )
}

function AmicareNavBehavior({ nonce }: { nonce?: string }) {
  const script = `(() => {
  const links = Array.from(document.querySelectorAll("[data-amicare-nav-link]"));
  const indicators = Array.from(document.querySelectorAll("[data-amicare-nav-indicator]"));
  if (!links.length) return;
  const ids = ["top", ...links.map((link) => link.getAttribute("data-amicare-nav-link")).filter(Boolean)];
  const setActive = (active) => {
    links.forEach((link) => {
      const isActive = link.getAttribute("data-amicare-nav-link") === active;
      link.classList.toggle("text-ink", isActive);
      link.classList.toggle("font-medium", isActive);
      link.classList.toggle("text-ink-muted", !isActive);
      if (isActive) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
    indicators.forEach((indicator) => {
      indicator.classList.toggle("hidden", indicator.getAttribute("data-amicare-nav-indicator") !== active);
    });
  };
  const onScroll = () => {
    let current = "top";
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= 100) current = id;
    });
    setActive(current);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
})();`
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: script }} />
}

export function AmicarePageRenderer({
  page,
  settings,
  theme,
  mediaResolver,
  formAction,
  className,
  canvasClassName,
  canvasAttributes,
  nonce,
  includeThemeStyle = true,
  includeBehaviorScripts = true,
  renderBlock,
  renderBlocks,
  renderHeader,
  renderFooter,
}: AmicarePageRendererProps) {
  const defaultRenderBlocks = page.blocks.map((block, index) => {
    const defaultRender = (
      <AmicareBlock
        block={block}
        index={index}
        mediaResolver={mediaResolver}
        formAction={formAction}
      />
    )

    return (
      <React.Fragment key={`${block.blockType}-${index}`}>
        {renderBlock ? renderBlock({ block, index, defaultRender }) : defaultRender}
      </React.Fragment>
    )
  })
  const defaultHeader = <AmicareNav settings={settings} mediaResolver={mediaResolver} />
  const defaultFooter = <AmicareFooter settings={settings} mediaResolver={mediaResolver} />

  return (
    <div
      className={cn("site-renderer site-renderer--legacy site-renderer--legacy-amicare", className)}
      data-siab-site-renderer
      data-legacy-tenant="amicare"
    >
      {includeThemeStyle && <ThemeStyle theme={theme} nonce={nonce} scope={PUBLIC_RENDERER_THEME_SCOPE} />}
      <div
        {...canvasAttributes}
        className={cn("rt-canvas w-full [container-name:site-frame] [container-type:inline-size]", canvasClassName)}
        data-rt-mode={themeMode(theme)}
        data-page-slug={page.slug}
      >
        <div className="site-frame-root">
          {renderHeader ? renderHeader({ defaultChrome: defaultHeader }) : defaultHeader}
          <AmicareMaintenanceBanner settings={settings} />
          <main>
            {renderBlocks ? renderBlocks({ blocks: page.blocks, defaultRenderBlocks }) : defaultRenderBlocks}
          </main>
          {renderFooter ? renderFooter({ defaultChrome: defaultFooter }) : defaultFooter}
        </div>
        {includeBehaviorScripts && (
          <>
            <AmicareCookieConsent enabled={Boolean(settings.analytics || page.analytics)} nonce={nonce} />
            <AmicareNavBehavior nonce={nonce} />
          </>
        )}
      </div>
    </div>
  )
}
