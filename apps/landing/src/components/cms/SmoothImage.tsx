import { useEffect, useRef, useState } from "preact/hooks"

type Props = {
  src: string
  alt?: string
  class?: string
  loading?: "lazy" | "eager"
}

/**
 * Drop-in replacement for <img> that crossfades when `src` changes.
 *
 * Production-safe: server renders a plain <img> with no wrapper div, no JS
 * dependency. The output carries an inline `transition`/`opacity` style
 * attribute, but the transition never fires on tenant pages because no
 * client-side hydration mounts the SmoothImage component there — only the
 * preview iframe hydrates it.
 * On hydration in the preview iframe, prop changes preload
 * the new src, then opacity-fade swap. Tenant production pages never see
 * crossfade behavior because they're not hydrated (server-only render).
 *
 * Footgun-aware:
 *   - Safari fires onload synchronously for cached resources. Set onload
 *     BEFORE src; immediately check `img.complete && naturalWidth > 0`
 *     to handle the sync-cache case.
 *   - Stale preloads from rapid src changes resolve out of order. Track
 *     latest requested src in a ref; bail in onload if it's stale.
 *   - onerror keeps current src + console.warn. No broken-image state.
 *   - First render initializes currentSrc = src (no preload, no flicker).
 */
export default function SmoothImage({ src, alt = "", class: className, loading = "lazy" }: Props) {
  const [currentSrc, setCurrentSrc] = useState(src)
  const [opacity, setOpacity] = useState(1)
  const latestRef = useRef(src)
  const isFirstRenderRef = useRef(true)

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return
    }
    if (src === currentSrc) return
    latestRef.current = src

    const img = new Image()
    img.onload = () => {
      // Bail if a newer src was requested while we were loading.
      if (latestRef.current !== src) return
      setOpacity(0)
      // Wait one frame for opacity transition to start, then swap.
      requestAnimationFrame(() => {
        setCurrentSrc(src)
        requestAnimationFrame(() => setOpacity(1))
      })
    }
    img.onerror = () => {
      if (latestRef.current !== src) return
      // eslint-disable-next-line no-console
      console.warn("[SmoothImage] failed to load:", src)
      // Keep currentSrc; no crossfade.
    }
    // onload BEFORE src — required for Safari sync-cache path.
    img.src = src
    if (img.complete && img.naturalWidth > 0) {
      // Already cached; onload may not fire. Trigger swap immediately.
      img.onload?.(new Event("load"))
    }
  }, [src, currentSrc])

  return (
    <img
      src={currentSrc}
      alt={alt}
      class={className}
      loading={loading}
      style={{ transition: "opacity 200ms ease-in-out", opacity }}
    />
  )
}
