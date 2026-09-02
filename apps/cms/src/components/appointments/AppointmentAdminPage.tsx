import type { ReactNode } from "react"
import type { Tenant, User } from "@/payload-types"
import { getPayload } from "payload"
import config from "@/payload.config"
import { getAdminLocale, getAdminTranslations } from "@/i18n/admin"
import { PageHeader } from "@/components/page-header"
import { ListPagination } from "@/components/list-pagination"
import { ListSearch } from "@/components/list-search"
import { EmptyState } from "@/components/empty-state"
import { AppointmentsTable } from "@/components/tables/AppointmentsTable"
import { AppointmentScheduleForm } from "@/components/appointments/AppointmentScheduleForm"
import { AppointmentCalendarSettings } from "@/components/appointments/AppointmentCalendarSettings"
import { getAppointmentSchedule } from "@/lib/appointments/service"
import { listAppointmentsPaginated } from "@/lib/queries/appointments"
import { CalendarDays, CalendarX2 } from "lucide-react"

const PAGE_SIZE = 25

export async function AppointmentAdminPage({
  user,
  tenant,
  returnPath,
  searchParams,
  beforeTitle,
}: {
  user: User
  tenant: Tenant
  returnPath: string
  searchParams: { page?: string; q?: string; saved?: string; error?: string; calendar?: string }
  beforeTitle?: ReactNode
}) {
  const t = await getAdminTranslations(user, "appointments")
  const payload = await getPayload({ config })
  const query = searchParams.q?.trim() || undefined
  const [schedule, appointments] = await Promise.all([
    getAppointmentSchedule(payload, tenant.id),
    listAppointmentsPaginated(tenant.id, {
      page: Number(searchParams.page) || 1,
      pageSize: PAGE_SIZE,
      q: query,
    }),
  ])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} subtitle={t("subtitle")} beforeTitle={beforeTitle} />
      <AppointmentScheduleForm
        initial={schedule}
        tenantId={String(tenant.id)}
        returnPath={returnPath}
        canEdit={user.role === "owner" || user.role === "super-admin"}
        result={searchParams.saved === "1" ? "saved" : searchParams.error}
      />
      <AppointmentCalendarSettings
        user={user}
        tenant={tenant}
        returnPath={returnPath}
        result={searchParams.calendar}
      />
      <section className="grid gap-4" aria-labelledby="appointments-ledger-heading">
        <div className="grid gap-1">
          <h2 id="appointments-ledger-heading" className="text-lg font-semibold">{t("ledgerTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("ledgerDescription")}</p>
        </div>
        <ListSearch placeholder={t("searchPlaceholder")} />
        <AppointmentsTable
          data={appointments.docs}
          locale={getAdminLocale(user)}
          tenantId={String(tenant.id)}
          returnPath={returnPath}
          emptyState={
            query ? (
              <EmptyState
                icon={<CalendarX2 className="h-10 w-10 text-muted-foreground" aria-hidden />}
                title={t("noMatching")}
                description={t("noMatchingDescription", { query })}
              />
            ) : (
              <EmptyState
                icon={<CalendarDays className="h-10 w-10 text-muted-foreground" aria-hidden />}
                title={t("none")}
                description={t("noneDescription")}
              />
            )
          }
        />
        <ListPagination
          page={appointments.page}
          totalPages={appointments.totalPages}
          total={appointments.totalDocs}
          pageSize={PAGE_SIZE}
        />
      </section>
    </div>
  )
}
