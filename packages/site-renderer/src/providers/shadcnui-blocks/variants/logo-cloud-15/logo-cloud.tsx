// Owned typed adaptation of upstream shadcnui-blocks logo-cloud-15 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { Marquee } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { useAnimationFrame } from "motion/react"
import { useRef } from "react"
import type { MediaResolver } from "../../../../media"
import {
  type LogoCloudLogoItem,
  renderLogoCloudLogo,
  renderLogoCloudTitle,
  sliceLogoCloudLogos,
} from "../../typed/logo-cloud-fields"
import { logoCloudFamilyCmsLike } from "../../typed/fixtures/logo-cloud-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import { Logo01, Logo02, Logo03, Logo04, Logo05, Logo06, Logo07, Logo08 } from "../../runtime/logos"
import { BorderBeam } from "./border-beam"

const BEAM_DURATION = 8
const BEAM_SIZE = 100
const MAX_LOGOS = 8
const LOGO_CLASS = "h-14"
const FALLBACK_LOGOS = [Logo01, Logo02, Logo03, Logo04, Logo05, Logo06, Logo07, Logo08] as const

const WAVE_SPAN_STYLE: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(90deg, currentColor 0%, currentColor 45%, var(--provider-accent-400, #ffaa40) 47%, var(--provider-accent-700, #9c40ff) 50%, var(--provider-accent-400, #ffaa40) 53%, currentColor 55%, currentColor 100%)",
  backgroundSize: "250% 100%",
  backgroundRepeat: "no-repeat",
  backgroundClip: "text",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundPosition: "0% center",
}

export type LogoCloud15Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  logos: LogoCloudLogoItem[]
  mediaResolver?: MediaResolver
  literalPreview?: boolean
}

export function LogoCloud15({
  title,
  logos,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
  literalPreview = false,
}: LogoCloud15Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLParagraphElement>(null)
  const waveSpanRef = useRef<HTMLSpanElement>(null)
  const startTimeRef = useRef<number | null>(null)
  const titleContent = renderLogoCloudTitle(editSlots, title, blockIndex)
  const displayLogos = sliceLogoCloudLogos(logos, MAX_LOGOS)

  useAnimationFrame((time) => {
    if (!(cardRef.current && textRef.current && waveSpanRef.current)) return

    if (startTimeRef.current === null) {
      startTimeRef.current = time
    }

    const elapsed = ((time - startTimeRef.current) / 1000) % BEAM_DURATION
    const beamOffset = (elapsed / BEAM_DURATION) * 100

    const cardRect = cardRef.current.getBoundingClientRect()
    const textRect = textRef.current.getBoundingClientRect()

    const W = cardRect.width
    const H = cardRect.height
    const perimeter = 2 * (W + H)

    const textLeft = Math.max(0, textRect.left - cardRect.left)
    const textRight = Math.min(W, textRect.right - cardRect.left)

    const textStartPercent = (textLeft / perimeter) * 100
    const textEndPercent = (textRight / perimeter) * 100

    const span = waveSpanRef.current

    if (beamOffset >= textStartPercent && beamOffset <= textEndPercent) {
      const t = (beamOffset - textStartPercent) / (textEndPercent - textStartPercent)
      span.style.backgroundPosition = `${95 - t * 90}% center`
    } else if (beamOffset < textStartPercent) {
      span.style.backgroundPosition = "0% center"
    } else {
      span.style.backgroundPosition = "100% center"
    }
  })

  return (
    <div className="flex min-h-screen items-center justify-center px-6" {...rootAttributes}>
      <div className="relative max-w-(--breakpoint-lg) rounded-lg border border-border" ref={cardRef}>
        <BorderBeam className="isolate -z-1" duration={BEAM_DURATION} size={BEAM_SIZE} />

        <div className="absolute inset-x-0 top-0 flex -translate-y-1/2 items-center justify-center px-10">
          <p
            className="bg-background px-3 text-center font-medium text-foreground/80 text-xl tracking-[-0.01em] sm:px-6"
            ref={textRef}
          >
            {literalPreview ? (
              <span ref={waveSpanRef} style={WAVE_SPAN_STYLE}>
                Trusted by 1000+ companies <span className="max-sm:hidden">around the world</span>
              </span>
            ) : titleContent ? (
              <span ref={waveSpanRef} style={WAVE_SPAN_STYLE}>
                {titleContent}
              </span>
            ) : null}
          </p>
        </div>

        <div className="grid">
          <div className="flex min-w-0 items-center justify-center gap-x-14 gap-y-10 p-10 pt-12 *:h-14">
            <Marquee className="mask-x-from-75% [--duration:20s] [&_svg]:mr-10" pauseOnHover>
              {literalPreview
                ? FALLBACK_LOGOS.map((Logo, itemIndex) => <Logo className={LOGO_CLASS} key={itemIndex} />)
                : displayLogos.map((logo, itemIndex) => (
                    <React.Fragment key={itemIndex}>
                      {renderLogoCloudLogo(logo, itemIndex, blockIndex, editSlots, mediaResolver, {
                        className: LOGO_CLASS,
                      })}
                    </React.Fragment>
                  ))}
            </Marquee>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LogoCloud15Literal() {
  return (
    <LogoCloud15
      title={logoCloudFamilyCmsLike.title}
      logos={logoCloudFamilyCmsLike.logos}
      blockIndex={0}
      literalPreview
    />
  )
}
