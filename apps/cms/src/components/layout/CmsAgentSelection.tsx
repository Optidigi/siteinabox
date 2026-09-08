"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { SiteEditorSnapshot } from "@/lib/agent/tools"

export type CmsAgentSelection = {
  tenantSlug: string | null
  pageSlug: string | null
  selectedBlockIndex: number | null
  applySnapshot: ((snapshot: SiteEditorSnapshot) => void) | null
}

const EMPTY: CmsAgentSelection = {
  tenantSlug: null,
  pageSlug: null,
  selectedBlockIndex: null,
  applySnapshot: null,
}

const CmsAgentSelectionStateContext = createContext<CmsAgentSelection>(EMPTY)
const CmsAgentSelectionSetContext = createContext<(next: CmsAgentSelection) => void>(() => undefined)

export function CmsAgentSelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<CmsAgentSelection>(EMPTY)
  return (
    <CmsAgentSelectionSetContext.Provider value={setSelection}>
      <CmsAgentSelectionStateContext.Provider value={selection}>
        {children}
      </CmsAgentSelectionStateContext.Provider>
    </CmsAgentSelectionSetContext.Provider>
  )
}

export function useCmsAgentSelection(next: CmsAgentSelection) {
  const setSelection = useContext(CmsAgentSelectionSetContext)
  useEffect(() => {
    setSelection(next)
    return () => setSelection(EMPTY)
  }, [next.tenantSlug, next.pageSlug, next.selectedBlockIndex, next.applySnapshot, setSelection])
}

export function useCmsAgentSelectionState(): CmsAgentSelection {
  return useContext(CmsAgentSelectionStateContext)
}
