import { requireOwnerSelectedSite } from "@/lib/routePolicy"
import { listUsersPaginated } from "@/lib/queries/users"
import { UsersTable } from "@/components/tables/UsersTable"
import { UserInviteForm } from "@/components/forms/UserInviteForm"
import { ListSearch } from "@/components/list-search"
import { ListPagination } from "@/components/list-pagination"
import { PageHeader } from "@/components/page-header"
import { TenantPill } from "@/components/layout/TenantPill"
import { EmptyState } from "@/components/empty-state"
import { Users, Search } from "lucide-react"
import { getAdminTranslations } from "@/i18n/admin"

const PAGE_SIZE = 10

export default async function TenantUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const { slug } = await params
  const { user, ctx, tenant } = await requireOwnerSelectedSite(slug)
  const t = await getAdminTranslations(user, "lists")
  const sp = await searchParams
  const q = String(sp.q ?? "").trim() || undefined
  const canManage = user.role === "super-admin" || user.role === "owner"
  const result = await listUsersPaginated({
    page: Number(sp.page) || 1,
    pageSize: PAGE_SIZE,
    q,
    tenantId: tenant.id,
  })
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("team.title")}
        beforeTitle={<TenantPill tenant={{ name: tenant.name, slug: tenant.slug }} href={ctx.mode === "tenant" ? "/" : undefined} />}
        action={canManage ? <UserInviteForm tenantId={tenant.id} canInviteOwners={user.role === "super-admin"} /> : undefined}
      />
      <ListSearch placeholder={t("filterTeam")} />
      <UsersTable
        data={result.docs}
        canManage={canManage}
        currentUserId={user.id}
        tenantId={tenant.id}
        emptyState={
          q ? (
            <EmptyState
              icon={<Search className="h-10 w-10 text-muted-foreground" aria-hidden />}
              title={t("team.noMatching")}
              description={t("team.noMatchingDescription", { query: q })}
            />
          ) : (
            <EmptyState
              icon={<Users className="h-10 w-10 text-muted-foreground" aria-hidden />}
              title={t("team.none")}
              description={t("team.noneDescription")}
              action={canManage ? <UserInviteForm tenantId={tenant.id} canInviteOwners={user.role === "super-admin"} /> : undefined}
            />
          )
        }
      />
      <ListPagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.totalDocs}
        pageSize={PAGE_SIZE}
      />
    </div>
  )
}
