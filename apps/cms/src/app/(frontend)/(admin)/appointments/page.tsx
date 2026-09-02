import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/authGate"
import { AppointmentAdminPage } from "@/components/appointments/AppointmentAdminPage"

export default async function TenantAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; saved?: string; error?: string; calendar?: string }>
}) {
  const { user, ctx } = await requireAuth()
  if (ctx.mode === "super-admin") redirect("/sites")
  return (
    <AppointmentAdminPage
      user={user}
      tenant={ctx.tenant}
      returnPath="/appointments"
      searchParams={await searchParams}
    />
  )
}
