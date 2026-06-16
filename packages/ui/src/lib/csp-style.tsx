"use client"

import * as React from "react"
import { useCspNonce } from "../lib/csp-nonce"

export function formatCssPx(value: number): string {
  if (!Number.isFinite(value)) return "0px"
  const rounded = Math.round(value * 1000) / 1000
  const normalized = Object.is(rounded, -0) ? 0 : rounded
  return `${normalized}px`
}

export function formatRuntimeCssValue(value: string | null | undefined): string | null {
  const next = value?.trim()
  if (!next || next === "undefined") return null
  if (!/^[a-zA-Z0-9\s.,()+%_-]+$/.test(next)) return null
  return next
}

export function formatCssUrl(value: string | null | undefined): string | null {
  const next = value?.trim()
  if (!next) return null
  const escaped = next
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\n\r\f]/g, "")
  return `url("${escaped}")`
}

export function formatCssColorValue(value: string | null | undefined): string | null {
  const next = value?.trim()
  if (!next) return null
  if (!/^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|(?:rgb|rgba|hsl|hsla|oklch|color)\([a-zA-Z0-9\s.,%#/+_-]+\)|var\(--[a-zA-Z0-9_-]+(?:,\s*[a-zA-Z0-9\s#.,%()+/_-]+)?\))$/.test(next)) {
    return null
  }
  return next
}

export function useCspStyleRule(
  prefix: string,
  declarations: string | null | undefined,
): { className: string; styleElement: React.ReactNode } {
  const nonce = useCspNonce()
  const reactId = React.useId()
  const safePrefix = React.useMemo(
    () => prefix.replace(/[^a-zA-Z0-9_-]/g, ""),
    [prefix],
  )
  const className = React.useMemo(
    () => `siab-csp-${safePrefix}-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [safePrefix, reactId],
  )
  const css = declarations?.trim()

  return {
    className,
    styleElement: css ? (
      <style
        nonce={nonce}
        suppressHydrationWarning
        data-siab-csp-style={prefix}
        dangerouslySetInnerHTML={{ __html: `.${className}{${css}}` }}
      />
    ) : null,
  }
}
