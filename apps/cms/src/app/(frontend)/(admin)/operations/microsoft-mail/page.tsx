import { getPayload } from "payload"
import { Badge } from "@siteinabox/ui/components/badge"
import { OperationsRouteTabs } from "@/components/generation/OperationsRouteTabs"
import { PageHeader } from "@/components/page-header"
import { requireRole } from "@/lib/authGate"
import { inspectMicrosoftMailReadiness } from "@/lib/microsoftMailProvisioning/readiness"
import { PayloadMicrosoftMailProvisioningStore } from "@/lib/microsoftMailProvisioning/payloadStore"
import type { MicrosoftMailProvisioningRequest } from "@/lib/microsoftMailProvisioning/model"
import config from "@/payload.config"
import { ProvisionMicrosoftMailForm } from "./ProvisionMicrosoftMailForm"
import Link from "next/link"
import { Button } from "@siteinabox/ui/components/button"

export const dynamic = "force-dynamic"

export default async function MicrosoftMailOperationsPage({ searchParams }: {
  searchParams: Promise<{ request?: string | string[] }>
}) {
  await requireRole(["super-admin"])
  const payload = await getPayload({ config })
  const params = await searchParams
  const requestedId = typeof params.request === "string" && /^\d+$/.test(params.request) ? Number(params.request) : null
  const [tenants, runs] = await Promise.all([
    payload.find({ collection: "tenants", limit: 250, depth: 0, sort: "name", overrideAccess: true }),
    payload.find({ collection: "microsoft-mail-provisioning-runs", limit: 12, depth: 0, sort: "-updatedAt", overrideAccess: true }),
  ])
  const tenantOptions = tenants.docs.map((tenant) => ({ id: String(tenant.id), name: tenant.name, domain: tenant.domain }))
  let initialRun: { id: string; request: MicrosoftMailProvisioningRequest; data: Record<string, unknown> } | undefined
  if (requestedId) {
    const run = await new PayloadMicrosoftMailProvisioningStore(payload).get(requestedId)
    if (run?.mode === "live" && run.data.requestSource === "customer_dashboard") {
      initialRun = { id: String(run.id), request: run.request, data: run.data }
      if (!tenantOptions.some((tenant) => tenant.id === String(run.tenantId))) {
        const tenant = await payload.findByID({ collection: "tenants", id: run.tenantId, depth: 0, overrideAccess: true }).catch(() => null)
        if (tenant) tenantOptions.push({ id: String(tenant.id), name: tenant.name, domain: tenant.domain })
      }
    }
  }
  const readiness = inspectMicrosoftMailReadiness()
  const partner = await payload.find({ collection: "microsoft-partner-connections", where: { partnerTenantId: { equals: process.env.MICROSOFT_PARTNER_TENANT_ID ?? "unconfigured" } }, limit: 1, depth: 0, overrideAccess: true })
  return <div className="flex flex-col gap-5">
    <PageHeader title="Microsoft mail" subtitle="Internal, super-admin-only provisioning for customer Microsoft 365 mailboxes." />
    <OperationsRouteTabs activePath="/operations/microsoft-mail" />
    <section className="grid gap-3 rounded-base border-2 border-border bg-muted/30 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2"><Badge variant={readiness.readyForLiveProvisioning ? "default" : "outline"}>{readiness.readyForLiveProvisioning ? "Configuration present" : "Setup incomplete"}</Badge><Badge variant="outline">Payment-gated provisioning</Badge></div>
      <p>Paid customer orders continue automatically. Bootstrap and Microsoft approval tasks remain internal. Provider errors and uncertain writes stop for reconciliation.</p>
      <div className="flex flex-wrap items-center gap-3"><span>Microsoft partner: {partner.docs[0]?.status ?? "Not connected"}</span><Button asChild variant="outline"><Link href="/operations/microsoft-mail/connect">Connect Microsoft partner account</Link></Button><Button asChild variant="outline"><Link href="/accounts">Manage customer pricing and services</Link></Button></div>
      <ul className="grid gap-1 sm:grid-cols-2">{readiness.items.map((item) => <li key={item.key} className="flex items-start gap-2"><Badge variant={item.ready ? "default" : "destructive"}>{item.ready ? "Ready" : "Missing"}</Badge><span><strong>{item.key}</strong>{item.ready ? "" : ` — ${item.requiredSettings.join(", ")}`}{item.note ? <span className="block text-muted-foreground">{item.note}</span> : null}</span></li>)}</ul>
    </section>
    <details className="rounded-base border p-4"><summary>Local mock simulator</summary><ProvisionMicrosoftMailForm tenants={tenantOptions} initialRun={initialRun} liveOrdersEnabled={false} /></details>
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">Recent provisioning runs</h2>
      {runs.docs.length === 0 ? <p className="rounded-base border p-4 text-sm text-muted-foreground">No Microsoft mail runs yet.</p> : <div className="overflow-x-auto rounded-base border-2 border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/30"><tr><th className="px-4 py-3">Domain</th><th className="px-4 py-3">State</th><th className="px-4 py-3">Request</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3">Updated</th></tr></thead>
          <tbody>{runs.docs.map((run) => <tr className="border-b last:border-0" key={run.id}>
            <td className="px-4 py-3 font-medium"><a className="underline" href={`/operations/microsoft-mail/${run.id}`}>{run.domain}</a></td>
            <td className="px-4 py-3"><Badge variant="outline">{run.state}</Badge></td>
            <td className="px-4 py-3">{run.data && typeof run.data === "object" && "customerConsent" in run.data ? <Badge variant="secondary">Customer consent captured</Badge> : <span className="text-muted-foreground">Operator draft</span>}</td>
            <td className="px-4 py-3">{run.mode}</td>
            <td className="px-4 py-3">{new Intl.DateTimeFormat("nl-NL", { dateStyle: "short", timeStyle: "short" }).format(new Date(run.updatedAt))}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  </div>
}
