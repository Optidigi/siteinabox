// Owned typed adaptation of upstream shadcnui-blocks features-04 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import {
  BookCheck,
  ChartPie,
  FolderSync,
  Goal,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import {
  featureItemIcon,
  renderFeatureItemDescription,
  renderFeatureItemImage,
  renderFeatureItemTitle,
  renderFeatureTitle,
  type FeatureItem,
} from "../../typed/feature-fields"
import { feature04Literal } from "../../typed/fixtures/feature-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import type { MediaResolver } from "../../../../media"

const ITEM_ICONS: LucideIcon[] = [Goal, BookCheck, ChartPie, Users, FolderSync, Zap]

export type Features04Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  features: FeatureItem[]
  mediaResolver?: MediaResolver
  literalPreview?: boolean
}

export function Features04({
  title,
  features,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
  literalPreview = false,
}: Features04Props) {
  const titleContent = renderFeatureTitle(editSlots, title, blockIndex)

  return (
    <div className="mx-auto w-full max-w-(--breakpoint-lg) px-6 py-20" {...rootAttributes}>
      {titleContent ? (
        <h2 className="max-w-lg text-pretty font-medium text-4xl tracking-[-0.04em] md:text-[2.75rem] md:leading-14">
          {titleContent}
        </h2>
      ) : null}
      <div className="mx-auto mt-8 grid w-full gap-12 md:mt-12 md:grid-cols-2">
        <div>
          <Accordion className="w-full" defaultValue="item-0" type="single">
            {features.map((feature, itemIndex) => {
              const Icon = featureItemIcon(feature.icon, ITEM_ICONS, itemIndex)
              return (
                <AccordionItem
                  className="group/accordion-item data-[state=open]:border-primary data-[state=open]:border-b-2"
                  key={itemIndex}
                  value={`item-${itemIndex}`}
                >
                  <AccordionTrigger className="text-lg group-first/accordion-item:pt-0 [&>svg]:hidden">
                    <div className="flex items-center gap-4">
                      {Icon ? <Icon /> : null}
                      {renderFeatureItemTitle(editSlots, feature.title, blockIndex, itemIndex)}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-[17px] text-muted-foreground leading-relaxed">
                    {feature.description
                      ? renderFeatureItemDescription(editSlots, feature.description, blockIndex, itemIndex, {
                          literalPreview,
                        })
                      : null}
                    <div className="mt-6 mb-2 aspect-video w-full rounded-xl bg-muted md:hidden">
                      {literalPreview
                        ? null
                        : renderFeatureItemImage(
                            editSlots,
                            mediaResolver,
                            feature.image,
                            feature.title,
                            blockIndex,
                            itemIndex,
                            { className: "size-full rounded-xl object-cover" },
                          )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        </div>
        <div className="hidden h-full w-full rounded-xl bg-muted md:block" />
      </div>
    </div>
  )
}

export default function Features04Literal() {
  return (
    <Features04
      title={feature04Literal.title}
      features={feature04Literal.features}
      blockIndex={0}
      literalPreview
    />
  )
}
