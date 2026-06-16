"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table"
import { Badge } from "@siteinabox/ui/components/badge"
import { statusVariant } from "@/lib/badge-helpers"
import { TypedConfirmDialog } from "@/components/typed-confirm-dialog"
import { Button } from "@siteinabox/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@siteinabox/ui/components/dropdown-menu"
import { MoreVertical, Pencil, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { relativeTime } from "@/lib/relativeTime"
import { statusLabel } from "@/lib/i18nLabels"
import type { Tenant } from "@/payload-types"
import { useStatusFeedback } from "@/components/status-feedback"

// FN-2026-0041 — Path A (TenantsTable Actions Delete) used generic copy
// while Path B (TenantEditForm Danger zone) showed live cascade counts.
// Two paths to the same destructive action shouldn't differ in
// information density. Lazy-fetch counts when the dialog opens.
type Counts = { pages: number; media: number; forms: number; siteSettings: number }
async function fetchTenantCounts(tenantId: number | string): Promise<Counts> {
  // The count endpoint takes a where filter; bundle 4 parallel calls.
  // Pre-fix shape would have needed a dedicated /api/tenants/:id/counts
  // endpoint, but Payload's REST count surface is flexible enough that
  // we don't need to add one.
  const where = encodeURIComponent(JSON.stringify({ tenant: { equals: tenantId } }))
  const fetchOne = (collection: string) =>
    fetch(`/api/${collection}/count?where=${where}`).then((r) => r.json()).then((j) => j.totalDocs ?? 0)
  const [pages, media, forms, siteSettings] = await Promise.all([
    fetchOne("pages"),
    fetchOne("media"),
    fetchOne("forms"),
    fetchOne("site-settings")
  ])
  return { pages, media, forms, siteSettings }
}

export function TenantsTable({ data, emptyState }: { data: Tenant[]; emptyState?: React.ReactNode }) {
  const t = useTranslations("sites")
  const tTable = useTranslations("table")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const status = useStatusFeedback()
  const [target, setTarget] = useState<Tenant | null>(null)
  const [counts, setCounts] = useState<Counts | null>(null)
  // FN-2026-0041 — when the dialog opens, kick off a lazy counts fetch.
  // Reset on close so a subsequent re-open doesn't show stale data.
  useEffect(() => {
    if (!target) {
      setCounts(null)
      return
    }
    let cancelled = false
    fetchTenantCounts(target.id).then((c) => {
      if (!cancelled) setCounts(c)
    }).catch(() => {
      // Network failure — leave counts null; the dialog falls back to
      // generic copy below. Better than blocking the destructive action.
    })
    return () => { cancelled = true }
  }, [target])

  const onDelete = async () => {
    if (!target) return
    const res = await fetch(`/api/tenants/${target.id}`, { method: "DELETE" })
    if (!res.ok) {
      const txt = await res.text().catch(() => "")
      throw new Error(`${t("delete")} (${res.status}): ${txt.slice(0, 200)}`)
    }
    status.success(t("deleted", { name: target.name }))
    router.refresh()
  }

  const cols: ColumnDef<Tenant, any>[] = [
    {
      accessorKey: "name",
      header: tTable("name"),
      cell: ({ row }) => <span className="font-medium">{row.getValue("name") as string}</span>,
      meta: { mobilePriority: "primary" }
    },
    {
      accessorKey: "domain",
      header: tTable("domain"),
      meta: { mobilePriority: "secondary" }
    },
    {
      accessorKey: "slug",
      header: tTable("slug"),
      cell: ({ getValue }) => <code className="text-xs">{getValue() as string}</code>,
      meta: { mobilePriority: "hidden" }
    },
    {
      accessorKey: "status",
      header: tTable("status"),
      cell: ({ getValue }) => { const s = getValue() as string; return <Badge variant={statusVariant(s)}><span className="size-1.5 rounded-full bg-current" aria-hidden />{statusLabel(tCommon, s)}</Badge> },
      meta: { mobilePriority: "secondary" }
    },
    {
      accessorKey: "updatedAt",
      header: tTable("updated"),
      cell: ({ getValue }) => relativeTime(getValue() as string),
      meta: { mobilePriority: "secondary" }
    },
    {
      id: "actions",
      header: "",
      meta: { mobilePriority: "action" },
      cell: ({ row }) => {
        const t = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                type="button"
                aria-label={tTable("actionsFor", { name: t.name })}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem asChild>
                <Link href={`/sites/${t.slug}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" /> {tCommon("edit")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={(e) => {
                  // Prevent the menu from closing AND swallowing the click;
                  // we want the dialog to take over.
                  e.preventDefault()
                  setTarget(t)
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> {tCommon("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ]

  return (
    <>
      <DataTable
        columns={cols}
        data={data}
        emptyState={emptyState}
        getRowHref={(t) => `/sites/${t.slug}`}
      />
      {target && (
        <TypedConfirmDialog
          open={!!target}
          onOpenChange={(o) => !o && setTarget(null)}
          title={t("deleteTitle", { name: target.name })}
          description={
            counts ? (
              t("deleteDescription", { name: target.name, domain: target.domain, pages: counts.pages, media: counts.media, forms: counts.forms })
            ) : (
              t("deleteDescriptionLoading", { name: target.name, domain: target.domain })
            )
          }
          confirmPhrase={target.slug}
          confirmLabel={t("delete")}
          onConfirm={onDelete}
        />
      )}
    </>
  )
}
