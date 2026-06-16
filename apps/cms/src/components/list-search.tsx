"use client"
import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Search, X } from "lucide-react"
import { Input } from "@siteinabox/ui/components/input"

/**
 * URL-driven search box for the admin list pages. Writes a debounced
 * ?q= param (and clears ?page= so results start at page 1); the server
 * component re-renders and re-queries. Seeded from the current ?q=.
 */
export function ListSearch({
  placeholder,
  paramKey = "q",
}: {
  placeholder?: string
  paramKey?: string
}) {
  const t = useTranslations("common")
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [value, setValue] = React.useState(params.get(paramKey) ?? "")
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const commit = React.useCallback(
    (next: string) => {
      const sp = new URLSearchParams(params.toString())
      const trimmed = next.trim()
      if (trimmed) sp.set(paramKey, trimmed)
      else sp.delete(paramKey)
      sp.delete("page")
      const qs = sp.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    },
    [params, paramKey, pathname, router],
  )

  const onChange = (next: string) => {
    setValue(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => commit(next), 300)
  }
  const resolvedPlaceholder = placeholder ?? t("search")

  return (
    <div className="relative w-full md:max-w-sm">
      <Search
        className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={resolvedPlaceholder}
        aria-label={resolvedPlaceholder}
        inputMode="search"
        enterKeyHint="search"
        autoCapitalize="none"
        autoCorrect="off"
        className="pl-8 pr-9"
      />
      {!!value && (
        <button
          type="button"
          onClick={() => {
            setValue("")
            if (timer.current) clearTimeout(timer.current)
            commit("")
          }}
          className="absolute right-1.5 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          aria-label={t("clearSearch")}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
