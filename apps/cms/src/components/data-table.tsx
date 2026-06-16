"use client"
import {
  type ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel,
  getPaginationRowModel, getSortedRowModel, type SortingState, useReactTable
} from "@tanstack/react-table"
import { useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@siteinabox/ui/components/table"
import { Card } from "@siteinabox/ui/components/card"
import { Input } from "@siteinabox/ui/components/input"
import { Button } from "@siteinabox/ui/components/button"
import { ChevronLeft, ChevronRight, FileQuestion, Search, X } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { cn } from "@siteinabox/ui/lib/utils"

type Props<T> = {
  columns: ColumnDef<T, any>[]
  data: T[]
  filterColumn?: string
  filterPlaceholder?: string
  emptyState?: React.ReactNode
  getRowHref?: (row: T) => string
}

export function DataTable<T>({ columns, data, filterColumn, filterPlaceholder, emptyState, getRowHref }: Props<T>) {
  const t = useTranslations("common")
  const [sorting, setSorting] = useState<SortingState>([])
  const [filter, setFilter] = useState("")

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  })

  const isEmpty = table.getRowModel().rows.length === 0
  const pageIndex = table.getState().pagination.pageIndex
  const pageSize = table.getState().pagination.pageSize
  const filteredRows = table.getFilteredRowModel().rows.length
  const currentFrom = filteredRows === 0 ? 0 : pageIndex * pageSize + 1
  const currentTo = Math.min((pageIndex + 1) * pageSize, filteredRows)
  // Distinguish "list is empty" (show caller-supplied empty state with
  // primary CTA like "+ New page") from "filter narrowed to zero rows"
  // (always show the generic "No results / adjust your search" state).
  // Without this, filtering a populated list to 0 results displays the
  // wrong copy ("No pages yet — create your first page").
  const isFilterNarrowed = isEmpty && data.length > 0

  return (
    <div className="space-y-3">
      {filterColumn && (
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            placeholder={filterPlaceholder ?? t("search")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            inputMode="search"
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            className="pl-8 pr-9"
          />
          {!!filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent text-muted-foreground"
              aria-label={t("clearSearch")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {isEmpty ? (
        isFilterNarrowed ? (
          <EmptyState
            icon={<FileQuestion className="h-10 w-10 text-muted-foreground" aria-hidden />}
            title={t("noResults")}
            description={t("noResultsDescription")}
          />
        ) : (
          emptyState ?? (
            <EmptyState
              icon={<FileQuestion className="h-10 w-10 text-muted-foreground" aria-hidden />}
              title={t("noResults")}
              description={t("noResultsDescription")}
            />
          )
        )
      ) : (
        <>
          {/* Phone card view */}
          <div className="md:hidden flex flex-col gap-2">
            {table.getRowModel().rows.map((row) => {
              const cells = row.getVisibleCells()
              const primary = cells.find((c) => c.column.columnDef.meta?.mobilePriority === "primary")
              const action = cells.find((c) => c.column.columnDef.meta?.mobilePriority === "action")
              const secondary = cells.filter((c) => {
                const p = c.column.columnDef.meta?.mobilePriority
                return p !== "primary" && p !== "action" && p !== "hidden"
              })
              const href = getRowHref?.(row.original)
              {/* U1 / U8 fix — row-Open Link is now a flex sibling of the
                  Action column instead of an absolutely positioned overlay.
                  Two consequences: (a) the Link's bounding box no longer
                  spans behind the Action button (UX-2026-0006 anchored by
                  GitHub issue #10), and (b) the layout no longer needs
                  pointer-events-none / z-index tricks to keep clicks on the
                  Action column from triggering the Link. The Action button's
                  own size bump (icon-sm → icon) lands separately in
                  PagesTable / TenantsTable / UsersTable. */}
              const inner = (
                <>
                  <div className={cn("flex-1 min-w-0 space-y-1", href && "[&_a]:text-inherit [&_a]:no-underline")}>
                    {primary && (
                      <div className="font-medium truncate">
                        {flexRender(primary.column.columnDef.cell, primary.getContext())}
                      </div>
                    )}
                    {secondary.length > 0 && (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        {secondary.map((cell, i) => (
                          <span key={cell.id} className="truncate inline-flex items-center gap-1">
                            {i > 0 && <span aria-hidden>·</span>}
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )
              return (
                // UX-2026-0029 — shadcn Card primitive ships with
                // `flex flex-col gap-6 ... py-6` baked in (its default is
                // vertical content stacks: header → content → footer). For a
                // list-row pattern we override:
                //   • `flex-row items-center gap-2` to lay out horizontally
                //     (text left, action right) — `flex-row` resolves the
                //     direction conflict with the Card's `flex-col` via
                //     tailwind-merge (later wins).
                //   • `!gap-2` and `!py-3` to override Card's `gap-6` / `py-6`
                //     defaults — these resolve via tailwind-merge naturally
                //     since `gap`/`p`/`py` utilities are in their own
                //     property groups; later wins.
                // tldr: this Card behaves like a row primitive, not a
                // structured-content card. shadcn convention for "list of
                // simple rows" is closer to a plain <div> with card
                // styling, but we keep Card here for the tokenized hover/
                // shadow behaviour and `data-slot="card"` attachments.
                <Card
                  key={row.id}
                  data-id={(row.original as any).id}
                  className={cn(
                    "flex-row items-center gap-2 px-3 py-3",
                    href && "hover:shadow-md active:scale-[0.99] transition-shadow",
                  )}
                >
                  {href ? (
                    <Link
                      href={href}
                      aria-label={t("open")}
                      className="flex-1 min-w-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                  {action && (
                    <div className="shrink-0">
                      {flexRender(action.column.columnDef.cell, action.getContext())}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block rounded-lg border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((g) => (
                  <TableRow key={g.id}>
                    {g.headers.map((h) => (
                      <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((r) => {
                  const rHref = getRowHref?.(r.original)
                  const cells = r.getVisibleCells()
                  // Identify the row's "primary" cell (the column marked for
                  // mobile-card primary slot). When getRowHref is provided,
                  // we wrap that ONE cell's content in a Link — that Link is
                  // the row's keyboard tabstop and visual nav affordance.
                  // Callers should NOT render their own <Link> inside the
                  // primary cell (would nest <a>); render plain text/span.
                  const primaryColIdx = cells.findIndex(
                    (c) => c.column.columnDef.meta?.mobilePriority === "primary"
                  )
                  return (
                    <TableRow key={r.id} data-id={(r.original as any).id}>
                      {cells.map((c, i) => {
                        const content = flexRender(c.column.columnDef.cell, c.getContext())
                        const isPrimary = i === primaryColIdx
                        return (
                          <TableCell key={c.id}>
                            {rHref && isPrimary ? (
                              <Link
                                href={rHref}
                                className="block w-full font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                              >
                                {content}
                              </Link>
                            ) : content}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      {table.getPageCount() > 1 && (
        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t bg-background/95 backdrop-blur px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            {t("showing", { from: currentFrom, to: currentTo, total: filteredRows })}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label={t("previousPage")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs text-muted-foreground">
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label={t("nextPage")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
