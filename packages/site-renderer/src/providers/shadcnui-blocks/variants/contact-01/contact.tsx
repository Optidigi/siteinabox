// Owned typed adaptation of upstream shadcnui-blocks contact-01 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { contact01CmsLike } from "../../typed/fixtures/contact-family"
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

export type Contact01Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  description?: RtRoot | null
  items: ContactDetailsItem[]
  showDemoChrome?: boolean
}

export function Contact01({
  title,
  description,
  items,
  blockIndex,
  editSlots,
  rootAttributes,
  showDemoChrome = false,
}: Contact01Props) {
  const titleContent = renderContactDetailsTitle(editSlots, title, blockIndex)
  const descriptionContent = renderContactDetailsDescription(editSlots, description, blockIndex)
  const displayItems = items.slice(0, MAX_ITEMS)

  return (
    <div className="flex min-h-screen items-center justify-center py-16" {...rootAttributes}>
      <div className="text-center">
        {showDemoChrome ? (
          <b className="font-medium text-muted-foreground text-sm uppercase tracking-wide">Contact Us</b>
        ) : null}
        {titleContent ? <h2 className="mt-3 font-medium text-4xl tracking-tight">{titleContent}</h2> : null}
        {descriptionContent ? (
          <p className="mt-3 text-lg text-muted-foreground md:text-xl">{descriptionContent}</p>
        ) : null}
        <div className="mx-auto grid max-w-(--breakpoint-xl) gap-16 px-6 py-24 md:grid-cols-2 md:gap-10 md:px-0 lg:grid-cols-3">
          {displayItems.map((item, itemIndex) => {
            const itemTitle = renderContactItemTitle(editSlots, item.title, blockIndex, itemIndex)
            const itemDescription = renderContactItemDescription(editSlots, item.description, blockIndex, itemIndex)
            const ContactIcon = resolveContactIcon(item.icon)
            if (!itemTitle && !itemDescription && !item.value) return null
            return (
              <div className="flex flex-col items-center text-center" key={itemIndex}>
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/30 bg-primary/5 text-primary shadow-xl/2 dark:bg-primary/10">
                  <ContactIcon />
                </div>
                {itemTitle ? <h3 className="mt-6 font-medium text-xl">{itemTitle}</h3> : null}
                {itemDescription ? <p className="mt-2 text-muted-foreground">{itemDescription}</p> : null}
                {renderContactItemLink(editSlots, item, blockIndex, itemIndex, {
                  className: "mt-4 font-medium text-primary",
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

export default function Contact01Literal() {
  return (
    <Contact01
      title={contact01CmsLike.title}
      description={contact01CmsLike.description}
      items={contact01CmsLike.items}
      blockIndex={0}
      showDemoChrome
    />
  )
}
