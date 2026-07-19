// Owned typed adaptation of upstream shadcnui-blocks logo-cloud-01 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { MediaRef, RtRoot } from "@siteinabox/contracts"
import type { BlockEditSlots, RendererElementPath, RendererSectionAttributes } from "../../../../blocks/types"
import { resolveMedia, type MediaResolver } from "../../../../media"
import { RichTextRenderer } from "../../../../rich-text"
import { Logo01, Logo02, Logo03, Logo04 } from "../../runtime/logos"

const BLOCK_TYPE = "logoCloud" as const
const MAX_LOGOS = 4
const LOGO_CLASS = "h-10"

type LogoItem = {
  name: string
  description?: string | null
  image?: MediaRef
  href?: string | null
}

const isExternalHref = (href: string) => /^(?:https?:)?\/\//i.test(href)

const previewInlineText = (text: string): RtRoot => ({
  t: "root",
  variant: "inline",
  children: [{ t: "text", v: text }],
})

const PREVIEW_TITLE = previewInlineText("More than 2.2 million companies worldwide already trust us")

const elementPath = (
  blockIndex: number,
  field: string,
  itemIndex?: number,
  subField?: string,
): RendererElementPath => ({ blockIndex, field, itemIndex, subField })

const renderInlineRichText = (
  editSlots: BlockEditSlots | undefined,
  field: string,
  value: RtRoot,
  blockIndex: number,
) => {
  const path = elementPath(blockIndex, field)
  const name = `${BLOCK_TYPE}.${field}`
  return editSlots?.renderRichText
    ? editSlots.renderRichText({
        name,
        value,
        variant: "inline",
        as: "span",
        className: "contents",
        elementPath: path,
        blockMode: "inline",
      })
    : <RichTextRenderer value={value} blockMode="inline" />
}

const renderTitle = (
  editSlots: BlockEditSlots | undefined,
  title: RtRoot | null | undefined,
  blockIndex: number,
) => {
  if (title) return renderInlineRichText(editSlots, "title", title, blockIndex)
  if (!editSlots?.renderRichText) return null
  return editSlots.renderRichText({
    name: `${BLOCK_TYPE}.title`,
    value: title ?? null,
    variant: "inline",
    as: "span",
    className: "contents",
    elementPath: elementPath(blockIndex, "title"),
    blockMode: "inline",
  })
}

const renderLogo = (
  logo: LogoItem,
  itemIndex: number,
  blockIndex: number,
  editSlots: BlockEditSlots | undefined,
  mediaResolver: MediaResolver | undefined,
) => {
  const name = logo.name?.trim() ?? ""
  const value = logo.image
  const resolved = resolveMedia(value ?? null, mediaResolver)
  const path = elementPath(blockIndex, "logos", itemIndex, "image")
  const content = editSlots?.renderImage
    ? editSlots.renderImage({
        name: `${BLOCK_TYPE}.logos.image`,
        value,
        alt: name,
        className: LOGO_CLASS,
        elementPath: path,
      })
    : resolved?.src
      ? <img className={LOGO_CLASS} src={resolved.src} alt={resolved.alt ?? name} />
      : null
  if (!content) return null

  const href = logo.href?.trim() ?? ""
  if (!href) return content
  const external = logo.href ? isExternalHref(href) : false
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
      {content}
    </a>
  )
}

export type LogoCloud01Props = {
  title?: RtRoot | null
  logos: LogoItem[]
  blockIndex: number
  editSlots?: BlockEditSlots
  mediaResolver?: MediaResolver
  rootAttributes?: RendererSectionAttributes
}

export function LogoCloud01({
  title,
  logos,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
}: LogoCloud01Props) {
  const titleContent = renderTitle(editSlots, title, blockIndex)
  const displayLogos = logos.slice(0, MAX_LOGOS)

  return (
    <div className="flex min-h-screen items-center justify-center px-6" {...rootAttributes}>
      <div>
        {titleContent ? <p className="text-center text-xl">{titleContent}</p> : null}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-14 *:h-10">
          {displayLogos.map((logo, itemIndex) => (
            <React.Fragment key={itemIndex}>
              {renderLogo(logo, itemIndex, blockIndex, editSlots, mediaResolver)}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LogoCloud01Literal() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div>
        <p className="text-center text-xl">
          <RichTextRenderer value={PREVIEW_TITLE} blockMode="inline" />
        </p>
        <div className="mt-14 flex flex-wrap items-center justify-center gap-14 *:h-10">
          <Logo01 className={LOGO_CLASS} />
          <Logo02 className={LOGO_CLASS} />
          <Logo03 className={LOGO_CLASS} />
          <Logo04 className={LOGO_CLASS} />
        </div>
      </div>
    </div>
  )
}
