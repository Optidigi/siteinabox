// Owned typed adaptation of upstream shadcnui-blocks cta-06 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { LinkRef, RtRoot } from "@siteinabox/contracts"
import { NeuroNoise } from "@paper-design/shaders-react"
import { ArrowUpRight } from "lucide-react"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { useTheme } from "../../runtime/theme"
import { renderCtaLink } from "../../typed/actions"
import { cta06Literal } from "../../typed/fixtures/cta-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import { fieldInlineRichText } from "../../typed/rich-text"

const BLOCK_TYPE = "cta" as const

export type Cta06Props = TypedVariantBaseProps & {
  headline: RtRoot
  description?: RtRoot | null
  primary?: LinkRef | null
  secondary?: LinkRef | null
}

export function Cta06({ headline, description, primary, secondary, blockIndex, editSlots, rootAttributes }: Cta06Props) {
  const { resolvedTheme } = useTheme()
  const primaryAction = renderCtaLink(editSlots, primary ?? {}, blockIndex, BLOCK_TYPE, "primary", {
    trailingIcon: <ArrowUpRight />,
  })
  const secondaryAction = renderCtaLink(editSlots, secondary ?? {}, blockIndex, BLOCK_TYPE, "secondary")

  return (
    <div className="px-0 py-16 sm:px-6" {...rootAttributes}>
      <div className="relative mx-auto max-w-5xl overflow-hidden border-y p-14 shadow-muted sm:rounded-xl sm:border-x sm:shadow-lg/5 border-border">
        <NeuroNoise
          brightness={0}
          className="mask-l-from-30% sm:mask-l-from-10% absolute inset-0"
          colorBack={resolvedTheme === "light" ? "rgba(0, 0, 0, 0.08)" : undefined}
          colorFront={resolvedTheme === "light" ? "rgba(0, 0, 0, 0.08)" : undefined}
          colorMid={resolvedTheme === "light" ? "rgba(0, 0, 0, 0.5)" : "rgba(255, 255, 255, 0.85)"}
          contrast={1}
          height={720}
          scale={0.55}
          speed={1}
          width={1280}
        />
        <div className="relative isolate">
          <h2 className="text-balance font-medium text-4xl text-foreground tracking-[-0.04em] md:leading-tight lg:text-[2.75rem]">
            {fieldInlineRichText(editSlots, BLOCK_TYPE, "headline", headline, blockIndex)}
          </h2>
          {description ? (
            <p className="mt-4 text-balance text-muted-foreground text-xl/normal md:mt-2.5 lg:text-[1.4rem]/normal">
              {fieldInlineRichText(editSlots, BLOCK_TYPE, "description", description, blockIndex)}
            </p>
          ) : null}
          {primaryAction || secondaryAction ? (
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              {primaryAction ? (
                <Button size="lg" asChild>
                  {primaryAction}
                </Button>
              ) : null}
              {secondaryAction ? (
                <Button size="lg" variant="outline" asChild>
                  {secondaryAction}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function Cta06Literal() {
  return (
    <Cta06
      headline={cta06Literal.headline}
      description={cta06Literal.description}
      primary={cta06Literal.primary}
      secondary={cta06Literal.secondary}
      blockIndex={0}
    />
  )
}
