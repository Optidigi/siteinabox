"use client"

import { Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import type { PreviewCheckoutDomainOption } from "@/lib/checkout/previewCheckoutContract"
import { DomainOptionRow } from "./DomainResultRow"

export function DomainSuggestions({
  loading,
  suggestions,
  placeholders = [],
  selectedDomain,
  onSelect,
}: {
  loading: boolean
  suggestions?: PreviewCheckoutDomainOption[]
  placeholders?: PreviewCheckoutDomainOption[]
  selectedDomain: string | null
  onSelect: (option: PreviewCheckoutDomainOption) => void
}) {
  const t = useTranslations("preview")
  if (!loading && !suggestions?.length && !placeholders.length) return null
  const visibleSuggestions = (suggestions ?? []).slice(0, 5)
  const visiblePlaceholders = placeholders.slice(0, Math.max(0, 5 - visibleSuggestions.length))
  return (
    <div className="grid gap-2" aria-live="polite">
      <div className="flex items-center gap-2 text-base font-medium text-foreground">{loading && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}<span>{t("checkoutDomainSuggestionsTitle")}</span></div>
      <div className="grid gap-2">
        {visibleSuggestions.map((option) => <DomainOptionRow key={option.domain} option={option} selected={selectedDomain === option.domain} onSelect={onSelect} />)}
        {visiblePlaceholders.map((option) => <DomainOptionRow key={`checking-${option.domain}`} option={option} checking />)}
      </div>
    </div>
  )
}
