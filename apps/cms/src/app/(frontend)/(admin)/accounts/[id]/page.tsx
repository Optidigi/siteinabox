import Link from "next/link"
import { getPayload } from "payload"
import config from "@/payload.config"
import { requireRole } from "@/lib/authGate"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { hasWorkspaceService } from "@/lib/tenants/services"
import { PolicyForm } from "./PolicyForm"

export default async function CustomerAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireRole(["super-admin"])
  const nl = user.language === "nl"
  const payload = await getPayload({ config })
  const { id } = await params
  const tenant = await payload.findByID({ collection: "tenants", id, user, overrideAccess: false })
  const services = await payload.find({ collection: "microsoft-mail-services", where: { tenant: { equals: tenant.id } }, limit: 1, overrideAccess: true })
  return <div className="grid max-w-4xl gap-5"><PageHeader title={tenant.name} />
    <div className="flex gap-3 text-sm"><Link className="underline" href={`/sites/${tenant.slug}/users`}>{nl ? "Team beheren" : "Manage team"}</Link><Link className="underline" href="/operations/microsoft-mail">{nl ? "E-mailbestellingen" : "Email orders"}</Link></div>
    {services.docs[0] ? <Link className="underline text-sm" href={`/accounts/${tenant.id}/email`}>{nl ? "Klantweergave e-mail openen" : "Open customer email flow"}</Link> : null}
    <PolicyForm nl={nl}><input type="hidden" name="tenantId" value={tenant.id} />
      <Card><CardHeader><CardTitle>{nl ? "Diensten" : "Services"}</CardTitle></CardHeader><CardContent className="grid gap-3">
        <label className="flex items-center gap-2"><input type="checkbox" name="website" defaultChecked={hasWorkspaceService(tenant, "website")} />Website</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="email" defaultChecked={hasWorkspaceService(tenant, "email")} />{nl ? "E-mail" : "Email"}</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="externalEmailBilling" defaultChecked={tenant.emailPaymentMethod === "manual"} />{nl ? "E-mailbetalingen buiten Siteinabox afhandelen" : "Invoice email outside Siteinabox"}</label>
        <Label htmlFor="authorized-mail-domain">{nl ? "Goedgekeurd e-maildomein" : "Authorized email domain"}</Label><Input id="authorized-mail-domain" name="mailDomain" defaultValue={services.docs[0]?.domain ?? ""} placeholder="example.nl" />
      </CardContent></Card>
      <Card><CardHeader><CardTitle>{nl ? "Platformtarief" : "Platform pricing"}</CardTitle></CardHeader><CardContent className="grid gap-3">
        <label className="flex items-center gap-2"><input type="checkbox" name="platformExempt" defaultChecked={tenant.platformPricing?.mode === "exempt"} />{nl ? "Vrijgesteld van Siteinabox-platformkosten" : "Exempt from Siteinabox platform fees"}</label>
        <p className="text-sm text-muted-foreground">{nl ? "Microsoft-licenties en domeinkosten blijven apart betaalbaar. Reeds geaccepteerde bestellingen veranderen niet." : "Microsoft licenses and domain costs remain payable. Existing accepted orders are unchanged."}</p>
        <Label htmlFor="pricing-reason">{nl ? "Reden" : "Reason"}</Label><Input id="pricing-reason" name="reason" defaultValue={tenant.platformPricing?.reason ?? ""} />
        <Label htmlFor="pricing-expiry">{nl ? "Einddatum (optioneel)" : "End date (optional)"}</Label><Input id="pricing-expiry" name="expiresAt" type="date" defaultValue={tenant.platformPricing?.expiresAt?.slice(0, 10) ?? ""} />
      <p className="text-sm text-muted-foreground">{nl ? "Na afloop of wijziging controleren we de factuurafspraken voordat automatische platformbetalingen hervatten." : "After expiry or a policy change, billing agreements require review before automatic platform collection resumes."}</p>
      </CardContent></Card>
    </PolicyForm>
    <details className="rounded-base border p-4"><summary>{nl ? "Wijzigingsgeschiedenis" : "Policy history"}</summary><pre className="overflow-auto text-xs">{JSON.stringify(tenant.commercialPolicyHistory ?? [], null, 2)}</pre></details>
  </div>
}
