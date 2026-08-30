import * as React from "react"
import type { ServiceIconName, ServicesBlock } from "@siteinabox/contracts"
import {
  SiteArrowRight,
  SiteBriefcase,
  SiteBuilding,
  SiteCalendar,
  SiteCamera,
  SiteCheckCircle,
  SiteClipboard,
  SiteClock,
  SiteGlobe,
  SiteHeart,
  SiteHouse,
  SiteLayers,
  SiteMapPin,
  SiteMessage,
  SitePackage,
  SiteRuler,
  SiteShieldCheck,
  SiteSpark,
  SiteStar,
  SiteUser,
  SiteWrench,
  type SiteIconProps,
} from "../../icons/SiteIcons"
import { Section, SectionInner, assertNever } from "../shared"
import type { BlockRenderOptions, RendererElementPath } from "../types"

type ServiceIcon = (props: SiteIconProps) => React.ReactElement

const serviceIcons: Record<ServiceIconName, ServiceIcon> = {
  briefcase: SiteBriefcase,
  building: SiteBuilding,
  calendar: SiteCalendar,
  camera: SiteCamera,
  "check-circle": SiteCheckCircle,
  clipboard: SiteClipboard,
  clock: SiteClock,
  globe: SiteGlobe,
  heart: SiteHeart,
  house: SiteHouse,
  layers: SiteLayers,
  "map-pin": SiteMapPin,
  message: SiteMessage,
  package: SitePackage,
  ruler: SiteRuler,
  "shield-check": SiteShieldCheck,
  spark: SiteSpark,
  star: SiteStar,
  user: SiteUser,
  wrench: SiteWrench,
}

const defaultServiceIcons: readonly ServiceIconName[] = [
  "briefcase",
  "check-circle",
  "shield-check",
  "wrench",
  "layers",
  "star",
]

function fieldPath(options: BlockRenderOptions, field: string, itemIndex?: number, subField?: string): RendererElementPath {
  return {
    blockIndex: options.index,
    field,
    ...(itemIndex === undefined ? {} : { itemIndex }),
    ...(subField === undefined ? {} : { subField }),
  }
}

function editableText(
  options: BlockRenderOptions,
  value: string,
  name: string,
  path: RendererElementPath,
): React.ReactNode {
  return options.editSlots?.renderText
    ? options.editSlots.renderText({ name, value, className: "", multiline: true, elementPath: path })
    : value
}

function serviceAction(
  item: ServicesBlock["items"][number],
  options: BlockRenderOptions,
  itemIndex: number,
  className = "site-services-01-action",
): React.ReactNode {
  if (!item.action) return null

  const elementPath = fieldPath(options, "items", itemIndex, "action")
  if (options.editSlots?.renderCta) {
    return options.editSlots.renderCta({
      name: "action",
      value: item.action,
      className,
      showArrow: false,
      elementPath,
    })
  }

  return (
    <a
      href={item.action.href}
      className={className}
      {...(item.action.external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      <span>{item.action.label}</span>
      <SiteArrowRight size={16} />
    </a>
  )
}

function Services01Block({ block, options }: { block: ServicesBlock; options: BlockRenderOptions }) {
  const headingId = `siab-services-heading-${options.index}`
  const introId = block.intro ? `siab-services-intro-${options.index}` : undefined
  const Heading = options.index === 0 ? "h1" : "h2"

  return (
    <Section
      options={options}
      id={options.sectionAttributes?.id}
      aria-labelledby={headingId}
      {...(introId ? { "aria-describedby": introId } : {})}
      data-siab-services-design="services-01"
      className="site-services site-services-01 relative"
    >
      <SectionInner className="site-services-01-inner">
        <header className="site-services-01-heading">
          <Heading id={headingId} className="site-services-01-title">
            {editableText(options, block.heading, "heading", fieldPath(options, "heading"))}
          </Heading>
          {block.intro ? (
            <p id={introId} className="site-services-01-intro">
              {editableText(options, block.intro, "intro", fieldPath(options, "intro"))}
            </p>
          ) : null}
        </header>

        <ul className="site-services-01-grid" data-item-count={block.items.length}>
          {block.items.map((item, index) => {
            const iconName = item.icon ?? defaultServiceIcons[index % defaultServiceIcons.length]!
            const Icon = serviceIcons[iconName]
            return (
              <li
                className="site-services-01-item-shell"
                data-siab-services-item-index={index}
                key={`${item.title}-${index}`}
              >
                <div className="site-services-01-item" data-siab-services-cell="true">
                  <span className="site-services-01-icon" aria-hidden="true">
                    <Icon size={32} />
                  </span>
                  <div className="site-services-01-item-copy">
                    <h3 className="site-services-01-item-title">
                      {editableText(options, item.title, "title", fieldPath(options, "items", index, "title"))}
                    </h3>
                    <p className="site-services-01-item-body">
                      {editableText(options, item.body, "body", fieldPath(options, "items", index, "body"))}
                    </p>
                    {serviceAction(item, options, index)}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </SectionInner>
    </Section>
  )
}

function Services02Block({ block, options }: { block: ServicesBlock; options: BlockRenderOptions }) {
  const headingId = `siab-services-heading-${options.index}`
  const introId = block.intro ? `siab-services-intro-${options.index}` : undefined
  const Heading = options.index === 0 ? "h1" : "h2"

  return (
    <Section
      options={options}
      id={options.sectionAttributes?.id}
      aria-labelledby={headingId}
      {...(introId ? { "aria-describedby": introId } : {})}
      data-siab-services-design="services-02"
      className="site-services site-services-02 relative"
    >
      <SectionInner className="site-services-02-inner">
        <header className="site-services-02-heading">
          <Heading id={headingId} className="site-services-02-title">
            {editableText(options, block.heading, "heading", fieldPath(options, "heading"))}
          </Heading>
          {block.intro ? (
            <p id={introId} className="site-services-02-intro">
              {editableText(options, block.intro, "intro", fieldPath(options, "intro"))}
            </p>
          ) : null}
        </header>

        <ul className="site-services-02-grid" data-item-count={block.items.length}>
          {block.items.map((item, index) => {
            const iconName = item.icon ?? defaultServiceIcons[index % defaultServiceIcons.length]!
            const Icon = serviceIcons[iconName]
            return (
              <li
                className="site-services-02-item"
                data-siab-services-item-index={index}
                key={`${item.title}-${index}`}
              >
                <span className="site-services-02-icon" aria-hidden="true">
                  <Icon size={28} />
                </span>
                <div className="site-services-02-item-copy">
                  <div className="site-services-02-item-text">
                    <h3 className="site-services-02-item-title">
                      {editableText(options, item.title, "title", fieldPath(options, "items", index, "title"))}
                    </h3>
                    <p className="site-services-02-item-body">
                      {editableText(options, item.body, "body", fieldPath(options, "items", index, "body"))}
                    </p>
                  </div>
                  {serviceAction(item, options, index, "site-services-02-action")}
                </div>
              </li>
            )
          })}
        </ul>
      </SectionInner>
    </Section>
  )
}

export function ServicesBlockView({ block, options }: { block: ServicesBlock; options: BlockRenderOptions }) {
  switch (block.variant) {
    case "services-01":
      return <Services01Block block={block} options={options} />
    case "services-02":
      return <Services02Block block={block} options={options} />
    default:
      return assertNever(block.variant)
  }
}
