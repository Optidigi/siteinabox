import Link from "next/link"
import { getPayload } from "payload"
import { Button } from "@siteinabox/ui/components/button"
import { Badge } from "@siteinabox/ui/components/badge"
import config from "@/payload.config"
import type { DomainMigration } from "@/payload-types"
import { OperationsRouteTabs } from "@/components/generation/OperationsRouteTabs"
import { OperationsTableFrame } from "@/components/generation/OperationsTableFrame"
import { PageHeader } from "@/components/page-header"
import { requireRole } from "@/lib/authGate"

export const dynamic = "force-dynamic"

export default async function OperationMigrationsPage() {
  await requireRole(["super-admin"])
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: "domain-migrations",
    sort: "-updatedAt",
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })
  const migrations = result.docs as DomainMigration[]
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Domeinmigraties"
        subtitle="Bevroren migratieautoriteit, klantacties en beperkt operatorherstel."
      />
      <OperationsRouteTabs activePath="/operations/migrations" />
      <OperationsTableFrame
        title="Recente migraties"
        description="Deze lijst bevat geen transfercodes, zonesnapshots of providerpayloads."
        isEmpty={migrations.length === 0}
        emptyTitle="Geen domeinmigraties"
        emptyDescription="Geaccepteerde migraties verschijnen hier na een geslaagde betaling."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-4 py-3 font-medium">Domein</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Classificatie</th>
                <th className="px-4 py-3 font-medium">Autorisatie</th>
                <th className="px-4 py-3 font-medium">Bijgewerkt</th>
                <th className="px-4 py-3 text-right font-medium">Actie</th>
              </tr>
            </thead>
            <tbody>
              {migrations.map((migration) => (
                <tr key={migration.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {migration.domainNameAscii}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{migration.state}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {migration.acceptedClassification}
                  </td>
                  <td className="px-4 py-3">
                    {migration.operatorWorkAuthorizationState}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {new Intl.DateTimeFormat("nl-NL", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(migration.updatedAt))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/operations/migrations/${migration.id}`}>
                        Openen
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </OperationsTableFrame>
    </div>
  )
}
