"use client"

import type { ComponentProps, PointerEvent } from "react"
import { blurAfterPointerClick } from "./retro"

/** Browser behavior stays behind a client boundary, including in server forms. */
export function ButtonControl({ onPointerUp, ...props }: ComponentProps<"button">) {
  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    onPointerUp?.(event)
    if (!event.defaultPrevented) blurAfterPointerClick(event)
  }
  // lint:ui-composition:ignore — Button's internal client DOM boundary; importing Button here would recurse.
  return <button {...props} onPointerUp={handlePointerUp} />
}
