"use client"

import * as React from "react"
import {
  formatCssColorValue,
  formatCssPx,
  useCspStyleRule,
} from "@siteinabox/ui/lib/csp-style"
import { cn } from "@siteinabox/ui/lib/utils"

interface ShineBorderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  borderWidth?: number
  duration?: number
  shineColor?: string | string[]
  /** Classes for the opaque inner lid that punches the ring. */
  contentClassName?: string
  children: React.ReactNode
}

function buildShineFillDeclarations({
  duration,
  shineColor,
}: {
  duration: number
  shineColor: string | string[]
}): string | null {
  const colors = (Array.isArray(shineColor) ? shineColor : [shineColor])
    .map((color) => formatCssColorValue(color))
    .filter((color): color is string => Boolean(color))

  if (colors.length === 0) return null

  // Full-bleed animated fill only. The opaque child lid covers the interior so
  // only the ring gap shows the shine; overflow+radius on the wrapper clips it
  // (the old dual-mask punch escaped the rounded tray over the hero).
  return [
    `--duration:${duration}s`,
    `background-image:radial-gradient(transparent,transparent,${colors.join(",")},transparent,transparent)`,
    "background-size:300% 300%",
    "animation:siab-shine-border var(--duration) infinite linear",
  ].join(";")
}

function buildShineLidDeclarations(borderWidth: number): string {
  return `margin:${formatCssPx(borderWidth)}`
}

export function ShineBorder({
  borderWidth = 1,
  duration = 14,
  shineColor = "black",
  className,
  contentClassName,
  children,
  ...props
}: ShineBorderProps) {
  const shineStyle = useCspStyleRule(
    "shine-border",
    buildShineFillDeclarations({ duration, shineColor }),
  )
  const lidStyle = useCspStyleRule("shine-border-lid", buildShineLidDeclarations(borderWidth))

  return (
    <div className={cn("relative overflow-hidden", className)} {...props}>
      {shineStyle.styleElement}
      {lidStyle.styleElement}
      <div
        data-siab-shine-border
        aria-hidden
        className={cn(shineStyle.className, "pointer-events-none absolute inset-0 rounded-[inherit]")}
      />
      <div className={cn(lidStyle.className, "relative rounded-[inherit]", contentClassName)}>
        {children}
      </div>
    </div>
  )
}
