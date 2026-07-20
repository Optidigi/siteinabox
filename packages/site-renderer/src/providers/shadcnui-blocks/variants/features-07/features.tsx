// Owned typed adaptation of upstream shadcnui-blocks features-07 (MIT, see ../../LICENSE).
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
  featureItemIcon,
  renderFeatureIntro,
  renderFeatureItemDescription,
  renderFeatureItemImage,
  renderFeatureItemTitle,
  renderFeatureTitle,
  type FeatureItem,
} from "../../typed/feature-fields"
import { feature07Literal, feature07LiteralImages } from "../../typed/fixtures/feature-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import type { MediaResolver } from "../../../../media"
import Link from "../../runtime/link"

const ITEM_ICONS: LucideIcon[] = [Goal, BookCheck, ChartPie, Users, FolderSync, Zap]

export type Features07Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  features: FeatureItem[]
  mediaResolver?: MediaResolver
  literalPreview?: boolean
}

export function Features07({
  title,
  intro,
  features,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
  literalPreview = false,
}: Features07Props) {
  const titleContent = renderFeatureTitle(editSlots, title, blockIndex)
  const introContent = renderFeatureIntro(editSlots, intro, blockIndex)

  return (
    <div className="px-6 py-20" {...rootAttributes}>
      <div className="mx-auto w-full max-w-(--breakpoint-xl)">
        {titleContent ? (
          <h2 className="text-pretty font-medium text-4xl tracking-[-0.04em] sm:mx-auto sm:max-w-xl sm:text-center md:text-[2.75rem] md:leading-[1.2]">
            {titleContent}
          </h2>
        ) : null}
        {introContent ? (
          <p className="mt-3 text-pretty text-muted-foreground text-xl -tracking-[0.01em] sm:text-center md:text-2xl">
            {introContent}
          </p>
        ) : null}
        <div className="mt-12 grid gap-6 sm:mt-18 sm:gap-y-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, itemIndex) => {
            const href = feature.cta?.href?.trim() || "#"
            return (
              <Link href={href} key={itemIndex}>
                <div className="-mx-2 flex max-w-lg items-center gap-6 rounded-lg sm:mx-0">
                  <div className="aspect-square h-24 shrink-0 overflow-hidden rounded-lg border border-border/20 bg-muted">
                    {literalPreview ? (
                      <img
                        alt=""
                        className="size-full object-cover"
                        height={96}
                        src={feature07LiteralImages[itemIndex]}
                        width={96}
                      />
                    ) : (
                      renderFeatureItemImage(
                        editSlots,
                        mediaResolver,
                        feature.image,
                        feature.title,
                        blockIndex,
                        itemIndex,
                        { className: "size-full object-cover" },
                      )
                    )}
                  </div>
                  <div>
                    <span className="font-medium text-lg tracking-[-0.015em]">
                      {renderFeatureItemTitle(editSlots, feature.title, blockIndex, itemIndex)}
                    </span>
                    {feature.description ? (
                      <div className="mt-1 text-pretty text-muted-foreground">
                        {renderFeatureItemDescription(editSlots, feature.description, blockIndex, itemIndex)}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Features07Literal() {
  return (
    <Features07
      title={feature07Literal.title}
      intro={feature07Literal.intro}
      features={feature07Literal.features}
      blockIndex={0}
      literalPreview
    />
  )
}
