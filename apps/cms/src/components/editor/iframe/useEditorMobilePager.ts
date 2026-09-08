"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

export type EditorMobilePane = "agent" | "preview" | "inspector"

const PANES: EditorMobilePane[] = ["agent", "preview", "inspector"]
const DESKTOP_QUERY = "(min-width: 1280px)"

function isDesktopViewport() {
  return typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function paneFromScroll(el: HTMLDivElement): EditorMobilePane {
  const width = el.clientWidth || 1
  const index = Math.min(PANES.length - 1, Math.max(0, Math.round(el.scrollLeft / width)))
  return PANES[index] ?? "preview"
}

/** Lovable-style three-pane pager: agent | preview | inspector. */
export function useEditorMobilePager(initialPane: EditorMobilePane = "preview") {
  const pagerRef = useRef<HTMLDivElement>(null)
  const [pane, setPane] = useState<EditorMobilePane>(initialPane)
  const [paging, setPaging] = useState(false)
  const settleTimer = useRef(0)

  const syncPane = useCallback(() => {
    const el = pagerRef.current
    if (!el || isDesktopViewport()) return
    setPane(paneFromScroll(el))
  }, [])

  const scrollToPane = useCallback((next: EditorMobilePane, behavior?: ScrollBehavior) => {
    const el = pagerRef.current
    if (!el || isDesktopViewport()) {
      setPane(next)
      return
    }
    const index = Math.max(0, PANES.indexOf(next))
    el.scrollTo({
      left: index * el.clientWidth,
      behavior: behavior ?? (prefersReducedMotion() ? "auto" : "smooth"),
    })
    setPane(next)
  }, [])

  useLayoutEffect(() => {
    const el = pagerRef.current
    if (!el) return
    const index = Math.max(0, PANES.indexOf(initialPane))
    el.scrollLeft = index * el.clientWidth
  }, [initialPane])

  useEffect(() => {
    const el = pagerRef.current
    if (!el) return

    const onScroll = () => {
      setPaging(true)
      syncPane()
      window.clearTimeout(settleTimer.current)
      settleTimer.current = window.setTimeout(() => {
        setPaging(false)
        syncPane()
      }, 140)
    }

    const onScrollEnd = () => {
      window.clearTimeout(settleTimer.current)
      setPaging(false)
      syncPane()
    }

    el.addEventListener("scroll", onScroll, { passive: true })
    el.addEventListener("scrollend", onScrollEnd)
    return () => {
      window.clearTimeout(settleTimer.current)
      el.removeEventListener("scroll", onScroll)
      el.removeEventListener("scrollend", onScrollEnd)
    }
  }, [syncPane])

  return { pagerRef, pane, paging, scrollToPane }
}
