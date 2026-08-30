import * as React from "react"
import type { SitegenBlockType } from "@siteinabox/contracts"
import { cn } from "@siteinabox/ui/lib/utils"
import type { BlockRenderOptions, RendererSectionAttributes } from "./types"

export function Section({
  children,
  options,
  className,
  ...props
}: {
  children: React.ReactNode
  options: BlockRenderOptions
  className?: string
} & Omit<React.ComponentPropsWithoutRef<"section">, "children" | "className">) {
  const custom = options.sectionAttributes
  const sectionProps: RendererSectionAttributes = {
    ...custom,
    ...props,
    className: cn(custom?.className, className),
  }
  return <section {...sectionProps}>{children}</section>
}

export function SectionInner({
  children,
  className,
  ...props
}: {
  children: React.ReactNode
  className?: string
} & Omit<React.ComponentPropsWithoutRef<"div">, "children" | "className">) {
  // 80rem is the owned structural frame. Individual components keep their
  // own readable measures instead of stretching copy to the frame edge.
  return <div {...props} className={cn("mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10", className)}>{children}</div>
}

/**
 * Temporary neutral output while the visual variant catalog is rebuilt.
 * This is deliberately not a selectable variant and is only useful for
 * keeping the editor/preview shell structurally inspectable during the reset.
 */
export function PendingBlock({
  blockType,
  heading,
  options,
}: {
  blockType: SitegenBlockType
  heading?: string
  options: BlockRenderOptions
}) {
  return (
    <Section
      options={options}
      id={options.sectionAttributes?.id}
      data-siab-block-state="variant-pending"
      className="border-y border-dashed border-border bg-muted/20 py-8"
    >
      <SectionInner>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {blockType} · variant pending
        </p>
        {heading ? <p className="mt-2 text-sm text-muted-foreground">{heading}</p> : null}
      </SectionInner>
    </Section>
  )
}

export function assertNever(value: never): never {
  throw new Error(`Unsupported Sitegen value: ${String(value)}`)
}
