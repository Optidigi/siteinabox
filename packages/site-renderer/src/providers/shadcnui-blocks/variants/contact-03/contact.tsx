// Owned typed adaptation of upstream shadcnui-blocks contact-03 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { contact03CmsLike } from "../../typed/fixtures/contact-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  renderContactDetailsDescription,
  renderContactDetailsTitle,
  renderContactItemDescription,
  renderContactItemLink,
  renderContactItemTitle,
  resolveContactIcon,
  type ContactDetailsItem,
} from "../../typed/contact-details-fields"

const MAX_ITEMS = 8

export type Contact03Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  description?: RtRoot | null
  items: ContactDetailsItem[]
}

export function Contact03({ title, description, items, blockIndex, editSlots, rootAttributes }: Contact03Props) {
  const titleContent = renderContactDetailsTitle(editSlots, title, blockIndex)
  const descriptionContent = renderContactDetailsDescription(editSlots, description, blockIndex)
  const displayItems = items.slice(0, MAX_ITEMS)

  return (
    <div className="flex min-h-screen items-center justify-center pt-12 pb-16 md:pt-16" {...rootAttributes}>
      <div className="mx-auto w-full max-w-(--breakpoint-xl) px-6 xl:px-0">
        <b className="font-medium text-muted-foreground text-sm uppercase tracking-wide">Contact Us</b>
        {titleContent ? <h2 className="mt-3 font-medium text-4xl tracking-[-0.04em]">{titleContent}</h2> : null}
        {descriptionContent ? (
          <p className="mt-3 text-lg text-muted-foreground md:text-xl">{descriptionContent}</p>
        ) : null}
        <div className="mt-14 grid gap-8 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {displayItems.map((item, itemIndex) => {
            const itemTitle = renderContactItemTitle(editSlots, item.title, blockIndex, itemIndex)
            const itemDescription = renderContactItemDescription(editSlots, item.description, blockIndex, itemIndex)
            const ContactIcon = resolveContactIcon(item.icon)
            if (!itemTitle && !itemDescription && !item.value) return null
            return (
              <div className="rounded-xl border border-dashed bg-muted/20 p-6 pb-8" key={itemIndex}>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground/5 text-foreground dark:bg-muted">
                  <ContactIcon />
                </div>
                {itemTitle ? <h3 className="mt-8 font-medium text-xl">{itemTitle}</h3> : null}
                {itemDescription ? <p className="mt-1.5 mb-4 text-muted-foreground">{itemDescription}</p> : null}
                {renderContactItemLink(editSlots, item, blockIndex, itemIndex, {
                  className: "font-medium",
                  target: item.icon === "map-pin" ? "_blank" : undefined,
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Contact03Literal() {
  return (
    <Contact03
      title={contact03CmsLike.title}
      description={contact03CmsLike.description}
      items={contact03CmsLike.items}
      blockIndex={0}
    />
  )
}
