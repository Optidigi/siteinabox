"use client"

import { useTranslations } from "next-intl"
import type { Appointment } from "@/payload-types"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button } from "@siteinabox/ui/components/button"
import { statusVariant } from "@/lib/badge-helpers"
import { statusLabel } from "@/lib/i18nLabels"
import { updateAppointmentStatusAction } from "@/app/(frontend)/(admin)/appointments/status-actions"

export function AppointmentsTable({ data, locale, tenantId, returnPath, emptyState }: { data: Appointment[]; locale: string; tenantId: string; returnPath: string; emptyState?: React.ReactNode }) {
  const tTable = useTranslations("table")
  const tCommon = useTranslations("common")
  const tAppointments = useTranslations("appointments")
  const formatDate = (value: string, timezone: string) => {
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value))
    } catch {
      return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    }
  }

  const columns: DataTableColumn<Appointment>[] = [
    {
      accessorKey: "startAt",
      header: tTable("when"),
      cell: ({ row }) => formatDate(row.original.startAt, row.original.timezone),
      meta: { mobilePriority: "primary" },
    },
    { accessorKey: "visitorName", header: tTable("name"), meta: { mobilePriority: "secondary" } },
    { accessorKey: "visitorEmail", header: tTable("email"), meta: { mobilePriority: "secondary" } },
    {
      accessorKey: "durationMinutes",
      header: tAppointments("durationShort"),
      cell: ({ getValue }) => `${getValue<number>()} min`,
      meta: { mobilePriority: "secondary" },
    },
    {
      accessorKey: "status",
      header: tTable("status"),
      cell: ({ getValue }) => {
        const value = getValue<string>()
        return <Badge variant={statusVariant(value)}>{statusLabel(tCommon, value)}</Badge>
      },
      meta: { mobilePriority: "secondary" },
    },
    {
      id: "actions",
      header: tTable("actions"),
      cell: ({ row }) => row.original.status === "confirmed" ? (
        <form action={updateAppointmentStatusAction} className="flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
          <input type="hidden" name="appointmentId" value={row.original.id} />
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <select name="status" defaultValue="" required aria-label={tAppointments("changeStatus")} className="h-9 rounded-md border bg-background px-2 text-xs">
            <option value="" disabled>{tAppointments("changeStatus")}</option>
            <option value="completed">{statusLabel(tCommon, "completed")}</option>
            <option value="no_show">{statusLabel(tCommon, "no_show")}</option>
            <option value="cancelled">{statusLabel(tCommon, "cancelled")}</option>
          </select>
          <Button type="submit" size="sm">{tCommon("save")}</Button>
        </form>
      ) : null,
      meta: { mobilePriority: "action" },
    },
  ]

  return <DataTable columns={columns} data={data} emptyState={emptyState} />
}
