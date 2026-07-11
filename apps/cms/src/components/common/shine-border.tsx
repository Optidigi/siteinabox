"use client"

import * as React from "react"
import {
  formatCssColorValue,
  formatCssPx,
  useCspStyleRule,
} from "@siteinabox/ui/lib/csp-style"
import { cn } from "@siteinabox/ui/lib/utils"

interface ShineBorderProps extends React.HTMLAttributes<HTMLDivElement> {
  borderWidth?: number
  duration?: number
  shineColor?: string | string[]
}

function buildShineBorderDeclarations({
  borderWidth,
  duration,
  shineColor,
}: {
  borderWidth: number
  duration: number
  shineColor: string | string[]
}): string | null {
  const colors = (Array.isArray(shineColor) ? shineColor : [shineColor])
    .map((color) => formatCssColorValue(color))
    .filter((color): color is string => Boolean(color))

  if (colors.length === 0) return null

  return [
    `--border-width:${formatCssPx(borderWidth)}`,
    `--duration:${duration}s`,
    `background-image:radial-gradient(transparent,transparent,${colors.join(",")},transparent,transparent)`,
    "background-size:300% 300%",
    "mask:linear-gradient(white 0 0) content-box,linear-gradient(white 0 0)",
    "-webkit-mask:linear-gradient(white 0 0) content-box,linear-gradient(white 0 0)",
    "-webkit-mask-composite:xor",
    "mask-composite:exclude",
    "padding:var(--border-width)",
    "animation:siab-shine-border var(--duration) infinite linear",
  ].join(";")
}

export function ShineBorder({
  borderWidth = 1,
  duration = 14,
  shineColor = "black",
  className,
  ...props
}: ShineBorderProps) {
  const shineStyle = useCspStyleRule(
    "shine-border",
    buildShineBorderDeclarations({ borderWidth, duration, shineColor }),
  )

  return (
    <>
      {shineStyle.styleElement}
      <div
        data-siab-shine-border
        className={cn(
          shineStyle.className,
          "pointer-events-none absolute inset-0 z-10 size-full rounded-[inherit] will-change-[background-position]",
          className,
        )}
        {...props}
      />
    </>
  )
}
