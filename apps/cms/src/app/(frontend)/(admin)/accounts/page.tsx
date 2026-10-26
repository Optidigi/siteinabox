import Link from "next/link"
import { getPayload } from "payload"
import config from "@/payload.config"
import { requireRole } from "@/lib/authGate"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@siteinabox/ui/components/card"
import { Button } from "@siteinabox/ui/components/button"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { platformFeesExempt } from "@/lib/tenants/services"
import { createCustomerWorkspace } from "./actions"

export default async function CustomerAccountsPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const { user } = await requireRole(["super-admin"])
  const nl = user.language === "nl"
  const payload = await getPayload({ config })
  const params = await searchParams
  const page = Math.max(1, Math.min(100000, Number.parseInt(params.page ?? "1",10) || 1))
  const q = params.q?.trim().slice(0,128) ?? ""
  const tenants = await payload.find({ collection: "tenants", limit: 50, page, sort: "name", user, overrideAccess: false, where: q ? { or: [{ name: { like: q } }, { slug: { like: q } }] } : undefined })
  const pageLink = (number: number) => `/accounts?${new URLSearchParams({page:String(number),q})}`
  return <div className="grid gap-5">
    <PageHeader title={nl ? "Klanten" : "Customer accounts"} />
    <form className="flex max-w-xl gap-2"><Input name="q" defaultValue={q} aria-label={nl ? "Klanten zoeken" : "Search customers"} /><Button type="submit" variant="outline">{nl ? "Zoeken" : "Search"}</Button></form>
    <Card><CardContent className="grid divide-y pt-5">{tenants.docs.map(tenant => <Link key={tenant.id} href={`/accounts/${tenant.id}`} className="flex flex-wrap justify-between gap-2 py-3">
      <span className="font-medium">{tenant.name}</span><span className="text-sm text-muted-foreground">{platformFeesExempt(tenant.platformPricing) ? (nl ? "Vrijgesteld van platformkosten" : "Platform fees exempt") : (nl ? "Standaardtarief" : "Standard pricing")}</span>
    </Link>)}</CardContent></Card>
    <nav aria-label="Pagination" className="flex gap-4 text-sm">{tenants.hasPrevPage ? <Link className="underline" href={pageLink(page-1)}>{nl ? "Vorige" : "Previous"}</Link> : null}{tenants.hasNextPage ? <Link className="underline" href={pageLink(page+1)}>{nl ? "Volgende" : "Next"}</Link> : null}</nav>
    <details className="rounded-base border p-4"><summary>{nl ? "Klant toevoegen" : "Add customer"}</summary>
      <form action={createCustomerWorkspace} className="mt-4 grid max-w-xl gap-3">
        <Label htmlFor="account-name">{nl ? "Klantnaam" : "Customer name"}</Label><Input id="account-name" name="name" required />
        <Label htmlFor="account-slug">{nl ? "Identificatie" : "Identifier"}</Label><Input id="account-slug" name="slug" pattern="[a-z0-9-]+" required />
        <Button type="submit" className="w-fit">{nl ? "Aanmaken" : "Create workspace"}</Button>
      </form>
    </details>
  </div>
}
