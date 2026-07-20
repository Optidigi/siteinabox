// Owned typed adaptation of upstream shadcnui-blocks hero-01 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { LinkRef, RtRoot } from "@siteinabox/contracts"
import { ArrowUpRight, CirclePlay } from "lucide-react"
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { cn } from "@siteinabox/ui/lib/utils"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import {
  renderHeroEyebrow,
  renderHeroHeadline,
  renderHeroLink,
  renderHeroSubheadline,
} from "../../typed/hero-fields"
import { heroFamilyCmsLike } from "../../typed/fixtures/hero-family"
import type { TypedVariantBaseProps } from "../../typed/props"

export type Hero01Props = TypedVariantBaseProps & {
  eyebrow?: RtRoot | null
  headline: RtRoot
  subheadline?: RtRoot | null
  cta?: LinkRef | null
  secondary?: LinkRef | null
}

export function Hero01({
  eyebrow,
  headline,
  subheadline,
  cta,
  secondary,
  blockIndex,
  editSlots,
  rootAttributes,
  ...rest
}: Hero01Props & React.HTMLAttributes<HTMLDivElement>) {
  const eyebrowContent = renderHeroEyebrow(editSlots, eyebrow, blockIndex)
  const primaryAction = renderHeroLink(editSlots, cta ?? {}, blockIndex, "cta", {
    trailingIcon: <ArrowUpRight className="size-5" />,
  })
  const secondaryAction = renderHeroLink(editSlots, secondary ?? {}, blockIndex, "secondary", {
    leadingIcon: <CirclePlay className="size-5" />,
  })

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6" {...rootAttributes} {...rest}>
      <DreamyBackground className="absolute inset-0 m-auto" />
      <div className="relative isolate max-w-3xl text-center">
        {eyebrowContent ? (
          <Badge asChild className="rounded-full bg-background/30 py-1 backdrop-blur-lg" variant="secondary">
            <span>
              {eyebrowContent}
              <ArrowUpRight className="ml-1 size-4" />
            </span>
          </Badge>
        ) : null}
        <h1 className="mx-auto mt-6 max-w-xl font-medium text-4xl tracking-tighter sm:text-[2.75rem] md:text-6xl/[1.2]">
          {renderHeroHeadline(editSlots, headline, blockIndex)}
        </h1>
        {subheadline ? (
          <p className="mx-auto mt-6 max-w-2xl text-foreground/70 text-xl md:text-2xl/normal">
            {renderHeroSubheadline(editSlots, subheadline, blockIndex)}
          </p>
        ) : null}
        {primaryAction || secondaryAction ? (
          <div className="mt-12 flex items-center justify-center gap-4">
            {primaryAction ? (
              <Button className="rounded-full transition-colors" size="lg" asChild>
                {primaryAction}
              </Button>
            ) : null}
            {secondaryAction ? (
              <Button className="rounded-full shadow-none transition-colors" size="lg" variant="outline" asChild>
                {secondaryAction}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// Upstream blob geometry (viewBox 0 0 1226 1065). Blur is baked into a canvas
// bitmap — never a live CSS/SVG filter — so CTA hover cannot flash translucent
// GPU filter rects. Intentionally wider than upstream; dual-tone via secondary accents.
const BLOB_VIEWBOX_W = 1226
const BLOB_VIEWBOX_H = 1065
const BLOB_SCALE_X = 1.58
const BLOB_SCALE_Y = 1.2
const BLOB_BLUR_PX = 64
const BLOB_PATH_0 =
  "M291.402 416.77C291.402 346.77 244.735 285.603 221.402 263.77C111.902 141.27 448.902 207.27 636.402 359.77C823.902 512.27 618.902 613.27 448.902 740.27C278.902 867.27 291.402 504.27 291.402 416.77Z"
const BLOB_PATH_1 =
  "M811.933 441.279C881.694 435.492 938.793 383.929 958.623 358.87C1071.65 239.618 1033.74 580.921 897.259 780.386C760.781 979.851 643.18 783.902 502.561 624.983C361.942 466.063 724.733 448.512 811.933 441.279Z"

type BlobStop = { offset: number; cssVar: string }
type BlobPaint = {
  path: string
  x1: number
  y1: number
  x2: number
  y2: number
  stops: readonly [BlobStop, BlobStop]
}

const BLOB_PAINTS: readonly BlobPaint[] = [
  {
    path: BLOB_PATH_0,
    x1: 155.902,
    y1: 200.271,
    x2: 592.902,
    y2: 696.271,
    stops: [
      { offset: 0, cssVar: "--provider-accent-600" },
      { offset: 1, cssVar: "--provider-accent-300" },
    ],
  },
  {
    path: BLOB_PATH_1,
    x1: 1016.49,
    y1: 288.346,
    x2: 558.314,
    y2: 764.853,
    stops: [
      { offset: 0, cssVar: "--provider-accent-secondary-700" },
      { offset: 1, cssVar: "--provider-accent-secondary-400" },
    ],
  },
]

function readCssVar(el: Element, name: string): string | null {
  const value = getComputedStyle(el).getPropertyValue(name).trim()
  return value || null
}

function paintDreamyBackground(canvas: HTMLCanvasElement, scope: Element) {
  const widthCss = canvas.clientWidth
  const heightCss = canvas.clientHeight
  if (widthCss < 1 || heightCss < 1) return

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const width = Math.max(1, Math.round(widthCss * dpr))
  const height = Math.max(1, Math.round(heightCss * dpr))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  const ctx = canvas.getContext("2d")
  if (!ctx) return

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)

  // Match SVG preserveAspectRatio="xMidYMid meet" for a full-bleed object-fit.
  const meet = Math.min(width / BLOB_VIEWBOX_W, height / BLOB_VIEWBOX_H)
  const offsetX = (width - BLOB_VIEWBOX_W * meet) / 2
  const offsetY = (height - BLOB_VIEWBOX_H * meet) / 2
  ctx.setTransform(meet, 0, 0, meet, offsetX, offsetY)

  const cx = BLOB_VIEWBOX_W / 2
  const cy = BLOB_VIEWBOX_H / 2
  ctx.translate(cx, cy)
  ctx.scale(BLOB_SCALE_X, BLOB_SCALE_Y)
  ctx.translate(-cx, -cy)

  // Blur radius is in canvas pixels and ignores the CTM — scale CSS 64px by DPR.
  ctx.filter = `blur(${BLOB_BLUR_PX * dpr}px)`

  for (const paint of BLOB_PAINTS) {
    const [start, end] = paint.stops.map((stop) => readCssVar(scope, stop.cssVar))
    if (!start || !end) continue
    const gradient = ctx.createLinearGradient(paint.x1, paint.y1, paint.x2, paint.y2)
    gradient.addColorStop(paint.stops[0].offset, start)
    gradient.addColorStop(paint.stops[1].offset, end)
    ctx.fillStyle = gradient
    ctx.fill(new Path2D(paint.path))
  }

  ctx.filter = "none"
}

function DreamyBackground({ className, style, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  React.useLayoutEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return

    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const scope = wrap.closest(".rt-canvas, [data-siab-theme-scope]") ?? wrap
        paintDreamyBackground(canvas, scope)
      })
    }

    schedule()

    const resizeObserver = new ResizeObserver(schedule)
    resizeObserver.observe(wrap)

    const themeRoot = wrap.closest(".rt-canvas, [data-siab-theme-scope]") ?? document.documentElement
    const mutationObserver = new MutationObserver(schedule)
    mutationObserver.observe(themeRoot, {
      attributes: true,
      attributeFilter: ["data-theme-color", "data-theme-font", "data-theme-shape", "data-rt-mode", "data-siab-theme-mode", "class", "style"],
    })
    if (themeRoot !== document.documentElement) {
      mutationObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-rt-mode", "data-siab-color-mode", "data-siab-theme-mode", "class"],
      })
    }

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [])

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={style}
      {...rest}
    >
      <canvas ref={canvasRef} className="absolute inset-0 m-auto h-full w-full" />
    </div>
  )
}

export default function Hero01Literal() {
  return (
    <Hero01
      eyebrow={heroFamilyCmsLike.eyebrow}
      headline={heroFamilyCmsLike.headline}
      subheadline={heroFamilyCmsLike.subheadline}
      cta={heroFamilyCmsLike.cta}
      secondary={heroFamilyCmsLike.secondary}
      blockIndex={0}
    />
  )
}
