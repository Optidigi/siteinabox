"use client"
import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@siteinabox/ui/lib/utils"
import { buttonVariants } from "@siteinabox/ui/components/button"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@siteinabox/ui/components/pagination"

// Compact page window: first + last always shown, current ±1, ellipsis
// for the gaps. total 12 / current 6 -> 1 … 5 6 7 … 12
function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const lo = Math.max(2, current - 1)
  const hi = Math.min(total - 1, current + 1)
  const out: (number | "gap")[] = [1]
  if (lo > 2) out.push("gap")
  for (let p = lo; p <= hi; p++) out.push(p)
  if (hi < total - 1) out.push("gap")
  out.push(total)
  return out
}

/**
 * URL-driven pagination for the admin list pages. Renders nothing for a
 * single page. Page links carry the current query string forward (so an
 * active ?q= search survives a page change) and drop ?page= for page 1.
 */
export function ListPagination({
  page,
  totalPages,
  total,
  pageSize,
}: {
  page: number
  totalPages: number
  total: number
  pageSize: number
}) {
  const t = useTranslations("common")
  const pathname = usePathname()
  const params = useSearchParams()

  if (totalPages <= 1) return null
  const current = Math.min(Math.max(page, 1), totalPages)

  const hrefFor = (p: number) => {
    const sp = new URLSearchParams(params.toString())
    if (p <= 1) sp.delete("page")
    else sp.set("page", String(p))
    const qs = sp.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  const from = (current - 1) * pageSize + 1
  const to = Math.min(current * pageSize, total)
  const stepClass = cn(buttonVariants({ variant: "ghost", size: "default" }), "gap-1 px-2.5")

  return (
    <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {t("showing", { from, to, total })}
      </p>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            {current > 1 ? (
              <Link href={hrefFor(current - 1)} aria-label={t("previous")} className={stepClass}>
                <ChevronLeft className="size-4" />
                <span className="hidden sm:block">{t("previous")}</span>
              </Link>
            ) : (
              <span aria-disabled className={cn(stepClass, "pointer-events-none opacity-50")}>
                <ChevronLeft className="size-4" />
                <span className="hidden sm:block">{t("previous")}</span>
              </span>
            )}
          </PaginationItem>

          {pageWindow(current, totalPages).map((p, i) =>
            p === "gap" ? (
              <PaginationItem key={`gap-${i}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <Link
                  href={hrefFor(p)}
                  aria-current={p === current ? "page" : undefined}
                  className={cn(
                    buttonVariants({ variant: p === current ? "outline" : "ghost", size: "icon" }),
                  )}
                >
                  {p}
                </Link>
              </PaginationItem>
            ),
          )}

          <PaginationItem>
            {current < totalPages ? (
              <Link href={hrefFor(current + 1)} aria-label={t("next")} className={stepClass}>
                <span className="hidden sm:block">{t("next")}</span>
                <ChevronRight className="size-4" />
              </Link>
            ) : (
              <span aria-disabled className={cn(stepClass, "pointer-events-none opacity-50")}>
                <span className="hidden sm:block">{t("next")}</span>
                <ChevronRight className="size-4" />
              </span>
            )}
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
