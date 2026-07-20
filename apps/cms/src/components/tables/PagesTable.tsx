"use client"
import type { PayloadRequest } from "payload"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ColumnDef, CellContext } from "@tanstack/react-table"
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
import { parsePayloadError } from "@/lib/api"
import { relativeTime } from "@/lib/relativeTime"
import { statusLabel } from "@/lib/i18nLabels"
import type { Page } from "@/payload-types"
import { useStatusFeedback } from "@/components/status-feedback"
import { pageEditorHref } from "@/lib/pageEditorUrls"

export function PagesTable({
  data,
  base,
  canManage = true,
  emptyState,
}: {
  data: Page[]
  base: string
  canManage?: boolean
  emptyState?: React.ReactNode
}) {
  const t = useTranslations("pages")
  const tTable = useTranslations("table")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const status = useStatusFeedback()
  const [target, setTarget] = useState<Page | null>(null)

  const onDelete = async () => {
    if (!target) return
    const res = await fetch(`/api/pages/${target.id}`, { method: "DELETE" })
    if (!res.ok) {
      const detail = await parsePayloadError(res)
      throw new Error(detail.message)
    }
    status.success(t("deleted", { title: target.title }))
    setTarget(null)
    router.refresh()
  }

  const cols: ColumnDef<Page, any>[] = [
    {
      accessorKey: "title",
      header: tTable("title"),
      cell: ({ row }) => <span className="font-medium">{row.getValue("title") as string}</span>,
      meta: { mobilePriority: "primary" }
    },
    {
      accessorKey: "slug",
      header: tTable("slug"),
      cell: ({ getValue }) => <code className="text-xs">{getValue() as string}</code>,
      meta: { mobilePriority: "secondary" }
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
    ...(canManage
      ? ([{
          id: "actions",
          header: "",
          meta: { mobilePriority: "action" },
          cell: ({ row }: CellContext<Page, unknown>) => {
            const p = row.original as Page
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    type="button"
                    aria-label={tTable("actionsFor", { name: p.title })}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem asChild>
                    <Link href={pageEditorHref(base, p)}>
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
                      setTarget(p)
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> {tCommon("delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )
          }
        }] as ColumnDef<Page, any>[])
      : [])
  ]

  return (
    <>
      <DataTable
        columns={cols}
        data={data}
        emptyState={emptyState}
        getRowHref={(p) => pageEditorHref(base, p)}
      />
      {target && (
        <TypedConfirmDialog
          open={!!target}
          onOpenChange={(o) => !o && setTarget(null)}
          title={t("deleteTitle", { title: target.title })}
          description={t("deleteDescription", { title: target.title })}
          confirmPhrase={target.slug}
          confirmLabel={t("delete")}
          onConfirm={onDelete}
        />
      )}
    </>
  )
}
