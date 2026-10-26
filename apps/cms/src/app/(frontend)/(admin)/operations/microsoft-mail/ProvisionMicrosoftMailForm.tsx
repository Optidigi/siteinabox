"use client"

import { useRef, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Button } from "@siteinabox/ui/components/button"
import { Checkbox } from "@siteinabox/ui/components/checkbox"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@siteinabox/ui/components/select"
import type { MicrosoftMailProvisioningRequest } from "@/lib/microsoftMailProvisioning/model"
import { startMockMicrosoftMailProvisioning } from "./actions"

type SiteTenant = { id: string; name: string; domain?: string | null }
type MailboxRow = { localPart: string; displayName: string; setupEmail: string }

export function ProvisionMicrosoftMailForm({ tenants, initialRun, liveOrdersEnabled = false }: {
  tenants: SiteTenant[]
  initialRun?: { id: string; request: MicrosoftMailProvisioningRequest; data: Record<string, unknown> }
  liveOrdersEnabled?: boolean
}) {
  const initialRequest = initialRun?.request
  const initialConsent = initialRun?.data.customerConsent && typeof initialRun.data.customerConsent === "object"
    ? initialRun.data.customerConsent as Record<string, unknown>
    : {}
  const provisioningDefaults = {
    mca2020FirstName: typeof initialConsent.signatoryFirstName === "string" ? initialConsent.signatoryFirstName : "",
    mca2020LastName: typeof initialConsent.signatoryLastName === "string" ? initialConsent.signatoryLastName : "",
    mca2020Email: typeof initialConsent.signatoryEmail === "string" ? initialConsent.signatoryEmail : "",
  }
  const [tenantId, setTenantId] = useState(initialRequest ? String(initialRequest.tenantId) : tenants[0]?.id ?? "")
  const formRef = useRef<HTMLFormElement | null>(null)
  const [domain, setDomain] = useState(initialRequest?.domain ?? tenants[0]?.domain ?? "")
  const [website, setWebsite] = useState(initialRequest?.customer.website ?? (tenants[0]?.domain ? `https://${tenants[0].domain}` : ""))
  const [users, setUsers] = useState<MailboxRow[]>(initialRequest ? initialRequest.mailboxUsers.map((user) => ({
    localPart: user.localPart,
    displayName: user.displayName,
    setupEmail: user.setupEmail,
  })) : [{ localPart: "", displayName: "", setupEmail: "" }])
  const [retainInfoForward, setRetainInfoForward] = useState(initialRequest?.retainInfoForward ?? true)
  const [infoForwardTo, setInfoForwardTo] = useState(initialRequest?.infoForwardTo ?? "")
  const infoAliasTarget = initialRequest?.infoAliasTarget ?? ""
  const selectedTenant = tenants.find((tenant) => tenant.id === tenantId)
  const defaultDomain = domain || selectedTenant?.domain || ""

  const updateUser = (index: number, field: keyof MailboxRow, value: string) => {
    setUsers((current) => current.map((user, userIndex) => userIndex === index ? { ...user, [field]: value } : user))
  }

  return <form ref={formRef} action={startMockMicrosoftMailProvisioning} className="grid gap-6">
    {initialRun ? <Alert>
      <AlertTitle>Customer request staged for provider review</AlertTitle>
      <AlertDescription>The customer recorded MCA acceptance and service authorization in Siteinabox. Their signatory details are prefilled for Pax8. Pax8 attestation is not yet confirmed. This form is internal; no order is placed until the annual order action is explicitly confirmed.</AlertDescription>
    </Alert> : <Alert>
      <AlertTitle>Mock mode only</AlertTitle>
      <AlertDescription>The button below saves a mock run and simulates providers without creating anything. This internal form can read Pax8 and validate mock orders; live orders remain disabled until the customer OBO/GDAP model is ready. Customer MCA acknowledgement is captured in the Siteinabox email page.</AlertDescription>
    </Alert>}

    <section className="grid gap-4 rounded-base border-2 border-border bg-card p-4 shadow-shadow">
      <h2 className="text-lg font-semibold">Customer and domain</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="customer-tenant">Siteinabox customer</Label>
          <Select name={initialRun ? undefined : "tenantId"} disabled={Boolean(initialRun)} value={tenantId} onValueChange={(id) => {
            setTenantId(id)
            const nextDomain = tenants.find((tenant) => tenant.id === id)?.domain ?? ""
            setDomain(nextDomain)
            setWebsite(nextDomain ? `https://${nextDomain}` : "")
          }} required>
            <SelectTrigger id="customer-tenant" className="w-full"><SelectValue placeholder="Choose a customer" /></SelectTrigger>
            <SelectContent>{tenants.map((tenant) => <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>)}</SelectContent>
          </Select>
          {initialRun ? <input type="hidden" name="tenantId" value={tenantId} /> : null}
        </div>
        <Field id="domain" name="domain" label="Email domain" placeholder="tap2case.nl" value={defaultDomain} onChange={setDomain} required />
        <Field id="tenantPrefix" name="tenantPrefix" label="Microsoft tenant prefix" placeholder="tap2case" defaultValue={initialRequest?.tenantPrefix ?? defaultDomain.split(".")[0]} required />
        <Field id="companyName" name="companyName" label="Legal company name" placeholder="Tap2case B.V." defaultValue={initialRequest?.customer.companyName} required />
        <Field id="website" name="website" label="Company website" placeholder="https://tap2case.nl" value={website} onChange={setWebsite} required />
        <Field id="companyPhone" name="companyPhone" label="Company phone" placeholder="+31 20 123 4567" defaultValue={initialRequest?.customer.phone} required />
        <Field id="street" name="street" label="Street and number" defaultValue={initialRequest?.customer.address.street} required />
        <Field id="city" name="city" label="City" defaultValue={initialRequest?.customer.address.city} required />
        <Field id="postalCode" name="postalCode" label="Postal code" defaultValue={initialRequest?.customer.address.postalCode} required />
        <Field id="country" name="country" label="Country code" defaultValue={initialRequest?.customer.address.country ?? "NL"} required />
        <Field id="registrationNumber" name="registrationNumber" label="Company registration number" defaultValue={initialRequest?.customer.registrationNumber} />
      </div>
      <h3 className="font-medium">Primary contact</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="contactFirstName" name="contactFirstName" label="First name" defaultValue={initialRequest?.customer.primaryContact.firstName} required />
        <Field id="contactLastName" name="contactLastName" label="Last name" defaultValue={initialRequest?.customer.primaryContact.lastName} required />
        <Field id="primaryContactEmail" name="primaryContactEmail" label="Existing contact email" type="email" defaultValue={initialRequest?.customer.primaryContact.email} required />
        <Field id="contactPhone" name="contactPhone" label="Contact phone" defaultValue={initialRequest?.customer.primaryContact.phone} required />
      </div>
      <p className="text-sm text-muted-foreground">Use an address the contact can already receive before the customer mailbox is created. Pax8 uses this as the primary Admin, Billing, and Technical contact.</p>
    </section>


    <section className="grid gap-4 rounded-base border-2 border-border bg-card p-4 shadow-shadow">
      <div>
        <h2 className="text-lg font-semibold">Mailboxes</h2>
        <p className="text-sm text-muted-foreground">One annual Microsoft 365 Business Basic EEA (no Teams) subscription, with seats equal to the mailbox count. Setup addresses are one-use Siteinabox delivery destinations.</p>
      </div>
      <input type="hidden" name="mailboxUsers" value={JSON.stringify(users)} />
      {users.map((user, index) => <div key={index} className="grid gap-3 rounded-base border p-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
        <Field id={`mailbox-local-${index}`} label="Mailbox name" placeholder="ardi" value={user.localPart} onChange={(value) => updateUser(index, "localPart", value)} required />
        <Field id={`mailbox-display-${index}`} label="Display name" placeholder="Ardi Example" value={user.displayName} onChange={(value) => updateUser(index, "displayName", value)} required />
        <Field id={`mailbox-setup-${index}`} label="One-time setup delivery email" type="email" placeholder="alternate@example.com" value={user.setupEmail} onChange={(value) => updateUser(index, "setupEmail", value)} required />
        <Button type="button" variant="outline" aria-label="Remove mailbox" disabled={users.length <= 1} onClick={() => setUsers((current) => current.filter((_, row) => row !== index))}><Trash2 aria-hidden /></Button>
      </div>)}
      <Button type="button" variant="outline" className="w-fit" disabled={users.length >= 300} onClick={() => setUsers((current) => [...current, { localPart: "", displayName: "", setupEmail: "" }])}><Plus aria-hidden />Add mailbox</Button>
    </section>

    <section className="grid gap-4 rounded-base border-2 border-border bg-card p-4 shadow-shadow">
      <h2 className="text-lg font-semibold">Existing info@ mail</h2>
      <label className="flex items-start gap-3 text-sm"><Checkbox name="retainInfoForward" checked={retainInfoForward} onCheckedChange={(checked) => setRetainInfoForward(checked === true)} /><span>Preserve <strong>info@{defaultDomain || "your-domain"}</strong> as a shared Microsoft mailbox and keep forwarding to the existing destination.</span></label>
      {retainInfoForward ? <Field id="infoForwardTo" name="infoForwardTo" label="Forward destination" type="email" placeholder="info@example.nl" value={infoForwardTo} onChange={setInfoForwardTo} required /> : <input type="hidden" name="infoForwardTo" value="" />}
      <p className="text-sm text-muted-foreground">The Exchange worker will enable external forwarding for this mailbox only. The current Cloudflare forwarding rule stays in place through DNS preparation and cutover.</p>
    </section>
    <input type="hidden" name="infoAliasTarget" value={infoAliasTarget} />

    {!initialRun ? <Button type="submit" className="w-fit" disabled={tenants.length === 0}>Run mocked end-to-end provisioning</Button> : null}
  </form>
}

function Field(props: {
  id: string; label: string; name?: string; type?: string; placeholder?: string; defaultValue?: string;
  value?: string; onChange?: (value: string) => void; required?: boolean
}) {
  return <div className="grid gap-2">
    <Label htmlFor={props.id}>{props.label}</Label>
    <Input id={props.id} name={props.name} type={props.type ?? "text"} placeholder={props.placeholder}
      defaultValue={props.value === undefined ? props.defaultValue : undefined} value={props.value}
      onChange={props.onChange ? (event) => props.onChange?.(event.target.value) : undefined} required={props.required} />
  </div>
}
