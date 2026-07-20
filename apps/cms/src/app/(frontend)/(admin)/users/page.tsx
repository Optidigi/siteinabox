import { requireAuth } from "@/lib/authGate"
import { listUsersPaginated } from "@/lib/queries/users"
import { UsersTable } from "@/components/tables/UsersTable"
import { UserInviteForm } from "@/components/forms/UserInviteForm"
import { CreateUserForm } from "@/components/forms/CreateUserForm"
import { ListSearch } from "@/components/list-search"
import { ListPagination } from "@/components/list-pagination"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { Users, Search } from "lucide-react"
import { getAdminTranslations } from "@/i18n/admin"
import { redirect } from "next/navigation"

const PAGE_SIZE = 10

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const { user, ctx } = await requireAuth()
  const t = await getAdminTranslations(user, "lists")
  const sp = await searchParams
  const q = String(sp.q ?? "").trim() || undefined
  const page = Number(sp.page) || 1

  if (ctx.mode === "super-admin") {
    const result = await listUsersPaginated({ page, pageSize: PAGE_SIZE, q })
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={t("users.title")} action={<CreateUserForm />} />
        <ListSearch placeholder={t("filterUsers")} />
        <UsersTable
          data={result.docs}
          canManage
          currentUserId={user.id}
          emptyState={
            q ? (
              <EmptyState
                icon={<Search className="h-10 w-10 text-muted-foreground" aria-hidden />}
                title={t("users.noMatching")}
                description={t("users.noMatchingDescription", { query: q })}
              />
            ) : (
              <EmptyState
                icon={<Users className="h-10 w-10 text-muted-foreground" aria-hidden />}
                title={t("users.none")}
                description={t("users.noneDescription")}
                action={<CreateUserForm />}
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

  // ctx.mode === "tenant" — tenant team page
  if (user.role !== "owner") redirect("/?error=forbidden")
  const tenantId = ctx.tenant.id
  const result = await listUsersPaginated({ page, pageSize: PAGE_SIZE, q, tenantId })
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("team.title")}
        action={<UserInviteForm tenantId={tenantId} />}
      />
      <ListSearch placeholder={t("filterTeam")} />
      <UsersTable
        data={result.docs}
        canManage
        currentUserId={user.id}
        tenantId={tenantId}
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
              action={<UserInviteForm tenantId={tenantId} />}
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
