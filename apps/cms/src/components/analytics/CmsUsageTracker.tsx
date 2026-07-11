"use client"

import { useEffect, useMemo, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"

type CmsDeviceType = "desktop" | "tablet" | "mobile" | "unknown"
type CmsElementRole = "link" | "button" | "submit" | "menuitem" | "unknown"
type CmsReferrerType = "direct" | "internal" | "external" | "unknown"

const API_PATH = "/api/cms-analytics"
const MAX_LABEL_LENGTH = 96

const routePatterns: Array<[RegExp, string]> = [
  [/^\/legal\/releases\/[^/]+$/, "/legal/releases/[id]"],
  [/^\/legal\/requirements\/[^/]+$/, "/legal/requirements/[id]"],
  [/^\/legal\/deliveries\/[^/]+$/, "/legal/deliveries/[id]"],
  [/^\/legal\/acceptances\/[^/]+$/, "/legal/acceptances/[id]"],
  [/^\/sites\/[^/]+\/pages\/new$/, "/sites/[slug]/pages/new"],
  [/^\/sites\/[^/]+\/pages\/edit\/[^/]+$/, "/sites/[slug]/pages/edit/[slug]"],
  [/^\/sites\/[^/]+\/pages\/[^/]+$/, "/sites/[slug]/pages/[id]"],
  [/^\/sites\/[^/]+\/users$/, "/sites/[slug]/users"],
  [/^\/sites\/[^/]+\/media$/, "/sites/[slug]/media"],
  [/^\/sites\/[^/]+\/forms$/, "/sites/[slug]/forms"],
  [/^\/sites\/[^/]+\/settings$/, "/sites/[slug]/settings"],
  [/^\/sites\/[^/]+\/analytics$/, "/sites/[slug]/analytics"],
  [/^\/sites\/[^/]+\/navigation$/, "/sites/[slug]/navigation"],
  [/^\/sites\/[^/]+\/edit$/, "/sites/[slug]/edit"],
  [/^\/sites\/[^/]+\/onboarding$/, "/sites/[slug]/onboarding"],
  [/^\/sites\/[^/]+$/, "/sites/[slug]"],
  [/^\/pages\/new$/, "/pages/new"],
  [/^\/pages\/edit\/[^/]+$/, "/pages/edit/[slug]"],
  [/^\/pages\/[^/]+$/, "/pages/[id]"],
  [/^\/users\/[^/]+\/edit$/, "/users/[id]/edit"],
]

const normalizeRoute = (path: string) => {
  const pathname = path.split("?")[0] || "/"
  const match = routePatterns.find(([rx]) => rx.test(pathname))
  return match?.[1] ?? pathname
}

const deviceType = (): CmsDeviceType => {
  if (typeof window === "undefined") return "unknown"
  const width = window.innerWidth
  if (!Number.isFinite(width) || width <= 0) return "unknown"
  if (width < 768) return "mobile"
  if (width < 1024) return "tablet"
  return "desktop"
}

const cleanActionKey = (value: string | null | undefined) => {
  const cleaned = value?.replace(/\s+/g, " ").trim()
  if (!cleaned || !/^[a-z0-9][a-z0-9._:-]*$/i.test(cleaned)) return null
  return cleaned.slice(0, MAX_LABEL_LENGTH)
}

const elementRole = (element: Element): CmsElementRole => {
  const role = element.getAttribute("role")
  if (role === "menuitem") return "menuitem"
  if (element instanceof HTMLAnchorElement) return "link"
  if (element instanceof HTMLButtonElement) return element.type === "submit" ? "submit" : "button"
  if (element instanceof HTMLInputElement && (element.type === "submit" || element.type === "button")) {
    return element.type === "submit" ? "submit" : "button"
  }
  return "unknown"
}

const actionLabel = (element: Element) =>
  cleanActionKey(element.getAttribute("data-cms-action"))

const actionTarget = (element: Element) => {
  if (element instanceof HTMLAnchorElement) {
    try {
      const url = new URL(element.href)
      if (url.origin === window.location.origin) return normalizeRoute(url.pathname)
    } catch {
      return null
    }
  }
  return null
}

const referrer = (previousPath: string | null): { type: CmsReferrerType; route: string | null } => {
  if (previousPath) return { type: "internal", route: normalizeRoute(previousPath) }
  if (!document.referrer) return { type: "direct", route: null }
  try {
    const url = new URL(document.referrer)
    if (url.origin === window.location.origin) return { type: "internal", route: normalizeRoute(url.pathname) }
    return { type: "external", route: null }
  } catch {
    return { type: "unknown", route: null }
  }
}

export const captureCmsBrowserEvent = (payload: Record<string, unknown>) => {
  const body = JSON.stringify(payload)
  if (body.length > 4096) return
  void fetch(API_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {})
}

export function CmsUsageTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const previousPath = useRef<string | null>(null)
  const lastClick = useRef<{ key: string; at: number } | null>(null)

  const currentPath = useMemo(() => {
    const query = searchParams.toString()
    return query ? `${pathname}?${query}` : pathname
  }, [pathname, searchParams])

  useEffect(() => {
    const source = referrer(previousPath.current)
    captureCmsBrowserEvent({
      event: "cms_route_viewed",
      cms_route: normalizeRoute(pathname),
      cms_referrer_type: source.type,
      ...(source.route ? { cms_referrer_route: source.route } : {}),
      cms_device_type: deviceType(),
      cms_element_role: "unknown",
    })
    previousPath.current = currentPath
  }, [currentPath, pathname])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element
        ? event.target.closest("a,button,[role='button'],[role='menuitem'],input[type='button'],input[type='submit']")
        : null
      if (!target) return
      const label = actionLabel(target)
      if (!label) return

      const role = elementRole(target)
      const targetRoute = actionTarget(target)
      const key = `${pathname}:${role}:${label}:${targetRoute ?? ""}`
      const now = Date.now()
      if (lastClick.current?.key === key && now - lastClick.current.at < 750) return
      lastClick.current = { key, at: now }

      captureCmsBrowserEvent({
        event: "cms_action_clicked",
        cms_route: normalizeRoute(pathname),
        cms_action: label,
        cms_element_role: role,
        cms_device_type: deviceType(),
        cms_referrer_type: "internal",
        ...(targetRoute ? { cms_action_target: targetRoute } : {}),
      })
    }

    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [pathname])

  return null
}
