"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type BuilderMobilePane = "chat" | "preview"

const DESKTOP_QUERY = "(min-width: 1024px)"

function isDesktopViewport() {
  return typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/** Lovable-style mobile pager: swipe between full-viewport chat and preview. */
export function useBuilderMobilePager() {
  const pagerRef = useRef<HTMLDivElement>(null)
  const [pane, setPane] = useState<BuilderMobilePane>("chat")
  const [paging, setPaging] = useState(false)
  const [desktop, setDesktop] = useState(false)
  const settleTimer = useRef<number>(0)

  const syncPane = useCallback(() => {
    const el = pagerRef.current
    if (!el || isDesktopViewport()) return
    const next: BuilderMobilePane = el.scrollLeft > el.clientWidth / 2 ? "preview" : "chat"
    setPane(next)
  }, [])

  const scrollToPane = useCallback((next: BuilderMobilePane) => {
    const el = pagerRef.current
    if (!el || isDesktopViewport()) return
    if (Math.abs(el.scrollLeft - (next === "preview" ? el.clientWidth : 0)) < 1) return
    setPaging(true)
    el.scrollTo({
      left: next === "preview" ? el.clientWidth : 0,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    })
    setPane(next)
  }, [])

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY)
    const sync = () => setDesktop(query.matches)
    sync(); query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])

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

  return { pagerRef, pane, paging, scrollToPane, desktop }
}
