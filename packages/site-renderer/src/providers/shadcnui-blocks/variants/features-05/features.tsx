// Owned typed adaptation of upstream shadcnui-blocks features-05 (MIT, see ../../LICENSE).
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
import { Card, CardContent, CardHeader } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import {
  featureItemIcon,
  renderFeatureIntro,
  renderFeatureItemDescription,
  renderFeatureItemTitle,
  renderFeatureTitle,
  type FeatureItem,
} from "../../typed/feature-fields"
import { feature05Literal } from "../../typed/fixtures/feature-family"
import type { TypedVariantBaseProps } from "../../typed/props"

const ITEM_ICONS: LucideIcon[] = [Goal, BookCheck, ChartPie, Users, FolderSync, Zap]

export type Features05Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  features: FeatureItem[]
  literalPreview?: boolean
}

export function Features05({
  title,
  intro,
  features,
  blockIndex,
  editSlots,
  rootAttributes,
  literalPreview = false,
}: Features05Props) {
  const titleContent = renderFeatureTitle(editSlots, title, blockIndex)
  const introContent = renderFeatureIntro(editSlots, intro, blockIndex)

  return (
    <div className="px-6 py-20" {...rootAttributes}>
      <div className="mx-auto w-full max-w-(--breakpoint-lg)">
        {titleContent ? (
          <h2 className="text-pretty text-center font-medium text-4xl tracking-[-0.04em] md:text-[2.75rem]">
            {titleContent}
          </h2>
        ) : null}
        {introContent ? (
          <p className="mt-3 text-center text-lg text-muted-foreground tracking-[-0.01em] md:text-2xl">
            {introContent}
          </p>
        ) : null}
        <div className="mx-auto mt-18 grid w-full gap-x-6 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, itemIndex) => {
            const Icon = featureItemIcon(feature.icon, ITEM_ICONS, itemIndex)
            return (
              <Card className="flex flex-col overflow-hidden rounded-xl pb-0 shadow-none" key={itemIndex}>
                <CardHeader>
                  {Icon ? <Icon /> : null}
                  <h4 className="mt-3! font-medium text-xl tracking-tight">
                    {renderFeatureItemTitle(editSlots, feature.title, blockIndex, itemIndex)}
                  </h4>
                  {feature.description ? (
                    literalPreview ? (
                      <p className="text-[17px] text-muted-foreground">
                        {renderFeatureItemDescription(editSlots, feature.description, blockIndex, itemIndex, {
                          literalPreview,
                        })}
                      </p>
                    ) : (
                      <div className="text-[17px] text-muted-foreground">
                        {renderFeatureItemDescription(editSlots, feature.description, blockIndex, itemIndex)}
                      </div>
                    )
                  ) : null}
                </CardHeader>
                <CardContent className="mt-auto px-0 pb-0">
                  <div className="ml-6 h-40 rounded-tl-xl bg-muted" />
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Features05Literal() {
  return (
    <Features05
      title={feature05Literal.title}
      intro={feature05Literal.intro}
      features={feature05Literal.features}
      blockIndex={0}
      literalPreview
    />
  )
}
