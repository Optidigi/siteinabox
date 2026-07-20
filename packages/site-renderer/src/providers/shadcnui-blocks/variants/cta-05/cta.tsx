// Owned typed adaptation of upstream shadcnui-blocks cta-05 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { LinkRef, RtRoot } from "@siteinabox/contracts"
import {
  ArrowUpRight,
  ComponentIcon,
  CpuIcon,
  Package,
  Zap,
} from "lucide-react"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { renderCtaLink } from "../../typed/actions"
import { cta05Literal } from "../../typed/fixtures/cta-family"
import { providerCircuitBoardStyle } from "../../typed/grid-pattern"
import type { TypedVariantBaseProps } from "../../typed/props"
import { fieldInlineRichText } from "../../typed/rich-text"

const BLOCK_TYPE = "cta" as const

const IconFrame = ({ children }: { children: React.ReactNode }) => (
  <div className="relative flex size-20 items-center justify-center border border-white/40 bg-white/10 max-md:hidden">
    {children}
    <div className="mask-y-from-75% absolute -inset-y-12 -left-px border-white/60 border-s border-dashed" />
    <div className="mask-y-from-75% absolute -inset-y-12 -right-px border-white/60 border-e border-dashed" />
    <div className="mask-x-from-75% absolute -inset-x-12 -top-px border-white/80 border-t border-dashed" />
    <div className="mask-x-from-75% absolute -inset-x-12 -bottom-px border-white/80 border-b border-dashed" />
  </div>
)

export type Cta05Props = TypedVariantBaseProps & {
  headline: RtRoot
  description?: RtRoot | null
  primary?: LinkRef | null
  secondary?: LinkRef | null
}

export function Cta05({ headline, description, primary, secondary, blockIndex, editSlots, rootAttributes }: Cta05Props) {
  const primaryAction = renderCtaLink(editSlots, primary ?? {}, blockIndex, BLOCK_TYPE, "primary", {
    trailingIcon: <ArrowUpRight />,
  })
  const secondaryAction = renderCtaLink(editSlots, secondary ?? {}, blockIndex, BLOCK_TYPE, "secondary")

  return (
    <div className="px-0 py-16 sm:px-6" {...rootAttributes}>
      <div className="relative mx-auto max-w-5xl overflow-hidden border-border/60 border-y p-14 sm:rounded-xl sm:border-x dark:bg-foreground">
        <div
          className="absolute inset-0 z-0 opacity-70"
          style={{
            background:
              "linear-gradient(150deg, #FFAB91 0%, #FFCDD2 20%, #FCE4EC 40%, #e2daf1 60%, #b39ddb 80%, #8b6ac8 100%)",
          }}
        />
        <div className="pointer-events-none absolute inset-0 z-0 opacity-60" style={providerCircuitBoardStyle} />
        <div className="absolute top-1/2 right-20 -translate-y-1/2">
          <IconFrame>
            <Zap className="size-12 fill-white/10 stroke-[1px] text-white/80" />
          </IconFrame>
          <div className="relative flex size-20 -translate-x-full items-center justify-center border border-white/40 bg-white/10 max-md:hidden">
            <Package className="size-12 fill-white/10 stroke-[1px] text-white/80" />
            <div className="mask-y-from-75% absolute -inset-y-12 -left-px border-white/60 border-s border-dashed" />
            <div className="mask-y-from-75% absolute -inset-y-12 -right-px border-white/60 border-e border-dashed" />
            <div className="mask-x-from-75% absolute -inset-x-12 -top-px border-white/80 border-t border-dashed" />
            <div className="mask-x-from-75% absolute -inset-x-12 -bottom-px border-white/80 border-b border-dashed" />
          </div>
          <IconFrame>
            <ComponentIcon className="size-12 fill-white/10 stroke-[1px] text-white/80" />
          </IconFrame>
        </div>
        <div className="absolute top-1/2 right-20 -translate-y-1/2">
          <div className="mask-r-from-75% relative flex size-20 translate-x-full items-center justify-center border border-white/40 bg-white/10 max-md:hidden">
            <CpuIcon className="size-12 fill-white/10 stroke-[1px] text-white/80" />
            <div className="mask-y-from-75% absolute -inset-y-12 -left-px border-white/60 border-s border-dashed" />
            <div className="mask-y-from-75% absolute -inset-y-12 -right-px border-white/60 border-e border-dashed" />
            <div className="mask-x-from-75% absolute -inset-x-12 -top-px border-white/80 border-t border-dashed" />
            <div className="mask-x-from-75% absolute -inset-x-12 -bottom-px border-white/80 border-b border-dashed" />
          </div>
        </div>
        <div className="relative isolate">
          <h2 className="text-balance font-medium text-4xl text-black/85 tracking-[-0.04em] md:leading-tight lg:text-[2.75rem]">
            {fieldInlineRichText(editSlots, BLOCK_TYPE, "headline", headline, blockIndex)}
          </h2>
          {description ? (
            <p className="mt-4 text-balance text-black/70 text-xl/normal md:mt-2.5 lg:text-[1.4rem]/normal">
              {fieldInlineRichText(editSlots, BLOCK_TYPE, "description", description, blockIndex)}
            </p>
          ) : null}
          {primaryAction || secondaryAction ? (
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              {primaryAction ? (
                <Button className="bg-neutral-950 text-white hover:bg-neutral-950/90" size="lg" asChild>
                  {primaryAction}
                </Button>
              ) : null}
              {secondaryAction ? (
                <Button
                  className="border-white/60 bg-white/50 text-black hover:bg-white/80 dark:border-white/60 dark:bg-white/50 dark:text-black dark:hover:bg-white/80"
                  size="lg"
                  variant="outline"
                  asChild
                >
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

export default function Cta05Literal() {
  return (
    <Cta05
      headline={cta05Literal.headline}
      description={cta05Literal.description}
      primary={cta05Literal.primary}
      secondary={cta05Literal.secondary}
      blockIndex={0}
    />
  )
}
