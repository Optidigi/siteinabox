"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@siteinabox/ui/components/table"
import { Badge } from "@siteinabox/ui/components/badge"
import { statusVariant } from "@/lib/badge-helpers"
import { relativeTime } from "@/lib/relativeTime"
import { statusLabel } from "@/lib/i18nLabels"
import type { ActivityEntry } from "@/lib/activity"
import { pageEditorHref } from "@/lib/pageEditorUrls"

// FN-2026-0046 + FN-2026-0057 — derive a drill-down href from the
// activity entry where possible. Pages route to the slug editor URL; forms
// route to /forms; etc.
//
// CRITICAL mode awareness (sister of the StatCards FN-0045 reviewer-
// downgrade in fn-batch-6 — same regression class missed in the same
// batch on this component): tenant-mode operators (owner/editor/viewer)
// must NOT be linked to /sites/<slug>/* — those routes gate with
// `requireRole(["super-admin"])` and would 1s-META-refresh redirect
// them to /?error=forbidden. For tenant-mode the canonical paths are
// the slugless host-resolved routes /pages/<id>, /forms, /media,
// /settings. Super-admin keeps the /sites/<slug>/... shape.
type Mode = "super-admin" | "tenant"
function entryHref(e: ActivityEntry, mode: Mode): string | null {
  if (mode === "tenant") {
    if (e.type === "page") return pageEditorHref("/pages", { id: e.id, slug: e.pageSlug })
    if (e.type === "form") return "/forms"
    if (e.type === "media") return "/media"
    if (e.type === "settings") return "/settings"
    return null
  }
  if (!e.tenantSlug) return null
  if (e.type === "page") return pageEditorHref(`/sites/${e.tenantSlug}/pages`, { id: e.id, slug: e.pageSlug })
  if (e.type === "form") return `/sites/${e.tenantSlug}/forms`
  if (e.type === "media") return `/sites/${e.tenantSlug}/media`
  if (e.type === "settings") return `/sites/${e.tenantSlug}/settings`
  return null
}

/**
 * UX-2026-0002 / GitHub issue #15 — Recent activity feed responsively
 * branches between a desktop Table and a mobile flat-list. The mobile
 * branch is a `divide-y` list of plain `<div>`s (NOT nested Cards —
 * batch-5's UX-2026-0029 fix demonstrates the flex-col-baked-in pitfall
 * with Card primitives in row layouts). Each mobile row shows
 *   - title row: "<what>" on left + StatusPill on right
 *   - meta row: "<who> · <when>" small + muted
 *   - tenant name surfaced inline when present (super-admin views)
 * The desktop Table preserves the existing 5-column shape.
 */
export function ActivityFeed({ entries, mode = "super-admin" }: { entries: ActivityEntry[]; mode?: Mode }) {
  const t = useTranslations("dashboard")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const labelStatus = (status: string) => statusLabel(tCommon as (key: string) => string, status)
  const labelWhat = (e: ActivityEntry) => e.type === "page" ? t("updatedItem", { title: e.title }) : e.title
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t("recentActivity")}</CardTitle></CardHeader>
      <CardContent className="p-0">
        {/* Desktop: 5-column table with the existing column-padding tweak
            so When sits under the title and Status ends at the same right
            edge as the card title row. */}
        <div className="hidden md:block">
          <Table className="[&_thead_th:first-child]:pl-6 [&_thead_th:last-child]:pr-6 [&_tbody_td:first-child]:pl-6 [&_tbody_td:last-child]:pr-6">
            <TableHeader>
              <TableRow>
                <TableHead>{t("when")}</TableHead>
                <TableHead>{t("site")}</TableHead>
                <TableHead>{t("what")}</TableHead>
                <TableHead>{t("who")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {t("noRecentActivity")}
                  </TableCell>
                </TableRow>
              )}
              {entries.map((e) => {
                const href = entryHref(e, mode)
                return (
                  <TableRow
                    key={`${e.type}:${e.id}`}
                    className={href ? "cursor-pointer hover:bg-muted/50 group" : undefined}
                  >
                    <TableCell className="text-muted-foreground">{relativeTime(e.updatedAt, locale)}</TableCell>
                    <TableCell>{e.tenantName ?? e.tenantId.slice(0, 8)}</TableCell>
                    <TableCell>
                      {/* FN-2026-0046 — when a drill-down target exists,
                          wrap the most identifying cell ("What") in a Link
                          so the row becomes navigable while preserving the
                          existing 5-column shape. Tailwind group: lets the
                          row's hover affect the link's underline. */}
                      {href ? (
                        <Link href={href} className="hover:underline group-hover:underline">
                          {labelWhat(e)}
                        </Link>
                      ) : (
                        <>{labelWhat(e)}</>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{e.updatedBy ?? "—"}</TableCell>
                    <TableCell><Badge variant={statusVariant(e.status)}><span className="size-1.5 rounded-full bg-current" aria-hidden />{labelStatus(e.status ?? "")}</Badge></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        {/* Mobile: flat divide-y list. Each row is a plain <div> with
            title + StatusPill on top, who · when on bottom (muted). */}
        <ul className="md:hidden divide-y border-t">
          {entries.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t("noRecentActivity")}
            </li>
          )}
          {entries.map((e) => {
            const what = labelWhat(e)
            const who = e.updatedBy ?? "—"
            const when = relativeTime(e.updatedAt, locale)
            const href = entryHref(e, mode)
            // FN-2026-0046 — wrap the entire mobile row in a Link when a
            // target exists. Use <Link> as the rendered <li>'s child so
            // the entire tap target is a single anchor (avoids nested
            // anchor pitfalls; the row contains no other <a>).
            const inner = (
              <>
                <div className="flex items-center justify-between gap-3 min-w-0">
                  <span className="font-medium truncate min-w-0">{what}</span>
                  <Badge variant={statusVariant(e.status)}><span className="size-1.5 rounded-full bg-current" aria-hidden />{labelStatus(e.status ?? "")}</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                  <span className="truncate min-w-0">{who}</span>
                  <span aria-hidden>·</span>
                  <span className="shrink-0">{when}</span>
                  {e.tenantName && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="truncate min-w-0">{e.tenantName}</span>
                    </>
                  )}
                </div>
              </>
            )
            return (
              <li key={`${e.type}:${e.id}`} data-slot="activity-row">
                {href ? (
                  <Link href={href} className="flex flex-col gap-1 px-4 py-3 active:bg-muted/50 hover:bg-muted/30 transition-colors">
                    {inner}
                  </Link>
                ) : (
                  <div className="flex flex-col gap-1 px-4 py-3">{inner}</div>
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
