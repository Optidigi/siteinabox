import { requireSuperAdminSelectedSite } from "@/lib/routePolicy"
import { AppointmentAdminPage } from "@/components/appointments/AppointmentAdminPage"
import { TenantPill } from "@/components/layout/TenantPill"

export default async function SelectedSiteAppointmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string; q?: string; saved?: string; error?: string; calendar?: string }>
}) {
  const { slug } = await params
  const { user, tenant } = await requireSuperAdminSelectedSite(slug)
  return (
    <AppointmentAdminPage
      user={user}
      tenant={tenant}
      returnPath={`/sites/${tenant.slug}/appointments`}
      searchParams={await searchParams}
      beforeTitle={<TenantPill tenant={{ name: tenant.name, slug: tenant.slug }} />}
    />
  )
}
