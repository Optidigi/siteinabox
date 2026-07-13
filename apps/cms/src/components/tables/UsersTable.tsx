"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table"
import { Badge } from "@siteinabox/ui/components/badge"
import { roleVariant } from "@/lib/badge-helpers"
import { TypedConfirmDialog } from "@/components/typed-confirm-dialog"
import { Button } from "@siteinabox/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@siteinabox/ui/components/dropdown-menu"
import { Mail, MoreVertical, Pencil, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { roleLabel } from "@/lib/i18nLabels"
import type { User } from "@/payload-types"
import { useStatusFeedback } from "@/components/status-feedback"
import { resendUserInvitation } from "@/lib/actions/inviteUser"

export function UsersTable({
  data,
  canManage,
  currentUserId,
  tenantId,
  emptyState,
}: {
  data: User[]
  canManage: boolean
  currentUserId?: number | string
  tenantId?: number | string
  emptyState?: React.ReactNode
}) {
  const t = useTranslations("users")
  const tTable = useTranslations("table")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const status = useStatusFeedback()
  // Single shared dialog target — set when the operator picks Delete from
  // a row's kebab menu.
  const [target, setTarget] = useState<User | null>(null)

  const remove = async () => {
    if (!target) return
    const res = await fetch(`/api/users/${target.id}`, { method: "DELETE" })
    if (!res.ok) {
      const txt = await res.text().catch(() => "")
      throw new Error(`${t("delete")} (${res.status}): ${txt.slice(0, 200)}`)
    }
    status.success(t("removed", { email: target.email }))
    router.refresh()
  }

  const resend = async (user: User) => {
    if (tenantId == null) return
    const result = await resendUserInvitation({ userId: user.id, tenantId })
    if (!result.ok) {
      status.error(result.error || t("resendInviteFailed"))
      return
    }
    status.success(t("resendInviteSent", { email: user.email }))
  }

  const cols: ColumnDef<User, any>[] = [
    {
      accessorKey: "name",
      header: tTable("name"),
      cell: ({ row }) => row.original.name || row.original.email,
      meta: { mobilePriority: "primary" }
    },
    {
      accessorKey: "email",
      header: tTable("email"),
      cell: ({ row }) => (
        <a
          href={`mailto:${row.original.email}`}
          className="hover:underline truncate"
          dir="ltr"
          title={row.original.email}
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.email}
        </a>
      ),
      meta: { mobilePriority: "secondary" }
    },
    {
      accessorKey: "role",
      header: tTable("role"),
      cell: ({ getValue }) => {
        const r = getValue() as string
        return (
          <Badge variant={roleVariant(r)}>
            {roleLabel(tCommon, r)}
          </Badge>
        )
      },
      meta: { mobilePriority: "secondary" }
    },
    ...(canManage
      ? ([{
          id: "actions",
          header: "",
          meta: { mobilePriority: "action" },
          cell: ({ row }: any) => {
            const u = row.original as User
            const isSelf = currentUserId != null && String(currentUserId) === String(u.id)
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    type="button"
                    aria-label={tTable("actionsFor", { name: u.email })}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {tenantId != null && (
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault()
                        void resend(u)
                      }}
                    >
                      <Mail className="mr-2 h-4 w-4" /> {t("resendInvite")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href={`/users/${u.id}/edit`}>
                      <Pencil className="mr-2 h-4 w-4" /> {tCommon("edit")}
                    </Link>
                  </DropdownMenuItem>
                  {!isSelf && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={(e) => {
                          e.preventDefault()
                          setTarget(u)
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> {tCommon("delete")}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          }
        }] as ColumnDef<User, any>[])
      : [])
  ]

  return (
    <>
      <DataTable columns={cols} data={data} emptyState={emptyState} />
      {target && (
        <TypedConfirmDialog
          open={!!target}
          onOpenChange={(o) => !o && setTarget(null)}
          title={t("remove")}
          description={
            <>
              {t("remove")} <strong>{target.email}</strong>.
            </>
          }
          confirmPhrase={target.email}
          confirmLabel={t("remove")}
          onConfirm={remove}
        />
      )}
    </>
  )
}
