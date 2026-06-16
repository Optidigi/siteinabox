"use client"
import { useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table"
import { Badge } from "@siteinabox/ui/components/badge"
import { statusVariant } from "@/lib/badge-helpers"
import { relativeTime } from "@/lib/relativeTime"
import { FormSubmissionSheet } from "@/components/forms/FormSubmissionSheet"
import { useTranslations } from "next-intl"
import { statusLabel } from "@/lib/i18nLabels"
import type { Form as FormDoc } from "@/payload-types"

export function FormsTable({ data, emptyState }: { data: FormDoc[]; emptyState?: React.ReactNode }) {
  const tTable = useTranslations("table")
  const tCommon = useTranslations("common")
  const [active, setActive] = useState<FormDoc | null>(null)

  const cols: ColumnDef<FormDoc, any>[] = [
    {
      accessorKey: "createdAt",
      header: tTable("when"),
      cell: ({ getValue }) => relativeTime(getValue() as string),
      meta: { mobilePriority: "secondary" }
    },
    {
      accessorKey: "email",
      header: tTable("from"),
      meta: { mobilePriority: "primary" }
    },
    {
      accessorKey: "name",
      header: tTable("name"),
      meta: { mobilePriority: "secondary" }
    },
    {
      accessorKey: "formName",
      header: tTable("form"),
      meta: { mobilePriority: "secondary" }
    },
    {
      accessorKey: "status",
      header: tTable("status"),
      cell: ({ getValue }) => { const s = getValue() as string; return <Badge variant={statusVariant(s)}><span className="size-1.5 rounded-full bg-current" aria-hidden />{statusLabel(tCommon, s)}</Badge> },
      meta: { mobilePriority: "secondary" }
    }
  ]

  return (
    <>
      {/* DataTable rows already have data-id attributes; we capture row clicks to open the sheet */}
      <div onClick={(e) => {
        const el = (e.target as HTMLElement).closest("[data-id]") as HTMLElement | null
        if (!el) return
        const id = el.dataset.id
        if (!id) return
        const found = data.find((d) => String(d.id) === id)
        if (found) setActive(found)
      }}>
        <DataTable columns={cols} data={data} emptyState={emptyState} />
      </div>
      <FormSubmissionSheet form={active} open={!!active} onOpenChange={(b) => !b && setActive(null)} />
    </>
  )
}
