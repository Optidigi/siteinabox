"use client"

import { useEffect, useState } from "react"

export type BuilderBusyPhase = "leest" | "schrijft" | "bouwt"

export const BUILDER_PHASE_COPY: Record<BuilderBusyPhase, string> = {
  leest: "Leest…",
  schrijft: "Schrijft…",
  bouwt: "Bouwt de homepage…",
}

export function builderAgentStatus(
  busy: boolean,
  hasPreview: boolean,
  phase: BuilderBusyPhase | null,
): string {
  if (busy) return BUILDER_PHASE_COPY[phase ?? "schrijft"]
  if (hasPreview) return "Preview staat klaar"
  return "Klaar voor je eerste site"
}

/** Honest wait labels: read, write, then build only on a first-site turn that is still running. */
export function useBuilderBusyPhase(busy: boolean, hasPreview: boolean): BuilderBusyPhase | null {
  const [phase, setPhase] = useState<BuilderBusyPhase | null>(null)

  useEffect(() => {
    if (!busy) {
      setPhase(null)
      return
    }
    setPhase("leest")
    const schrijft = window.setTimeout(() => setPhase("schrijft"), 700)
    const bouwt = hasPreview
      ? undefined
      : window.setTimeout(() => setPhase("bouwt"), 4000)
    return () => {
      window.clearTimeout(schrijft)
      if (bouwt) window.clearTimeout(bouwt)
    }
  }, [busy, hasPreview])

  return phase
}
