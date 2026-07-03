"use client"
import * as React from "react"
import { EditorFrameDocumentContext } from "@/components/editor/iframe/EditorFrameDocumentContext"

/**
 * Returns a stable hidden `<div class="rt-canvas">` mounted in the body
 * that callers can use as a CSSStyleDeclaration source via getComputedStyle
 * to resolve tenant `--color-*` / `--font-*` tokens. Some chips render outside
 * the canvas surface (inspector); this hook gives them a "shadow" canvas
 * for computed-style reads without leaking into layout.
 *
 * When the page editor iframe is ready, the anchor mounts inside the iframe
 * document so palette/default reads match the live canvas token scope.
 */
export const useAnchorRtCanvas = (): HTMLDivElement | null => {
  const frameDocument = React.useContext(EditorFrameDocumentContext)
  const [el, setEl] = React.useState<HTMLDivElement | null>(null)
  React.useEffect(() => {
    const ownerDocument = frameDocument ?? document
    const d = ownerDocument.createElement("div")
    d.className = "rt-canvas"
    d.style.position = "absolute"
    d.style.width = "0"
    d.style.height = "0"
    d.style.overflow = "hidden"
    d.style.visibility = "hidden"
    d.setAttribute("aria-hidden", "true")
    ownerDocument.body.appendChild(d)
    setEl(d)
    return () => { d.remove() }
  }, [frameDocument])
  return el
}
