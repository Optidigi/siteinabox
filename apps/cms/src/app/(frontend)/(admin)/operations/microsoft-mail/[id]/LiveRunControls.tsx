"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Button } from "@siteinabox/ui/components/button"
import { Checkbox } from "@siteinabox/ui/components/checkbox"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { continueLiveMicrosoftMailProvisioningAction, repairCustomerApplicationAccess } from "../actions"

type LiveRunControlsProps = {
  runId: string
  state: string
  currentStep: string | null
  customerTenantId: string | null
  initialDomain?: string | null
  issueCode: string | null
}

export function LiveRunControls(props: LiveRunControlsProps) {
  const router = useRouter()
  const [tenantId, setTenantId] = useState(props.customerTenantId ?? "")
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const terminal = ["ready", "failed", "manual_review", "cancelled"].includes(props.state)

  async function continueRun(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      const result = await continueLiveMicrosoftMailProvisioningAction(formData)
      setMessage(result.ok ? `Run paused at ${result.currentStep ?? result.state}.` : `Could not continue (${result.code}).`)
      router.refresh()
    })
  }

  return <div className="grid gap-4 rounded-base border-2 border-border bg-card p-4 shadow-shadow">
    <div><h2 className="text-lg font-semibold">Live provisioning controls</h2><p className="text-sm text-muted-foreground">Each continuation checks provider state and stops at the next customer or operator decision.</p></div>
    {props.issueCode ? <Alert variant="destructive"><AlertTitle>Run needs attention</AlertTitle><AlertDescription>{props.issueCode}</AlertDescription></Alert> : null}
    {!terminal ? <form action={continueRun} className="grid gap-4">
      <input type="hidden" name="runId" value={props.runId} />
      <div className="grid gap-2"><Label htmlFor="m365-customer-tenant-id">Customer Microsoft tenant ID</Label><Input id="m365-customer-tenant-id" name="customerTenantId" value={tenantId} onChange={(event) => setTenantId(event.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autoComplete="off" readOnly={Boolean(props.customerTenantId)} /><p className="text-xs text-muted-foreground">Use the Microsoft tenant GUID returned after Pax8 provisions the customer. Siteinabox stores the verified customer mapping.</p></div>
      {!props.customerTenantId ? <div className="grid gap-2"><Label htmlFor="m365-initial-domain">Verified initial Microsoft domain</Label><Input id="m365-initial-domain" name="customerInitialDomain" defaultValue={props.initialDomain ?? ""} placeholder="customer.onmicrosoft.com" required /></div> : null}
      {!props.customerTenantId && tenantId.trim() ? <label className="flex items-start gap-2 text-sm"><Checkbox name="confirmPax8TenantLink" /><span>I verified this Microsoft tenant ID belongs to this customer and authorize linking it to the Pax8 customer record.</span></label> : null}
      {props.currentStep === "mca_acceptance" ? <label className="flex items-start gap-2 text-sm"><Checkbox name="confirmMcaAccepted" /><span>I verified agreement completion through Pax8 or the customer Global Administrator and recorded the supporting reference.</span></label> : null}
      {props.currentStep === "mca_acceptance" ? <div className="grid gap-2"><Label htmlFor="agreement-confirmation-reference">Pax8/Microsoft agreement confirmation reference</Label><Input id="agreement-confirmation-reference" name="mcaConfirmationReference" required /></div> : null}
      {props.currentStep === "mca_acceptance" || props.currentStep === "gdap" || props.currentStep === "application_consent" ? <p className="text-sm text-muted-foreground">Complete the Microsoft action shown above, then use this button to recheck its status.</p> : null}
      <Button type="submit" className="w-fit" variant={props.currentStep === "dns_cutover" ? "warning" : "default"} disabled={pending}>{pending ? "Checking and continuing…" : props.currentStep === "dns_cutover" ? "Confirm MX cutover and continue" : "Continue provisioning / refresh status"}</Button>
    </form> : <p className="text-sm">This run is {props.state}; automatic continuation is disabled.</p>}
    {["CUSTOMER_RECONSENT_REQUIRED", "EXCHANGE_ACCESS_REQUIRES_REVIEW"].includes(props.issueCode ?? "") ? <form action={async (formData) => { setMessage(null); startTransition(async () => { try { await repairCustomerApplicationAccess(formData); router.refresh() } catch { setMessage("Access repair could not be started. Review the order and connection.") } }) }} className="grid gap-3">
      <input type="hidden" name="runId" value={props.runId} />
      <label className="flex items-start gap-2 text-sm"><Checkbox name="confirmGrantRepair" required /><span>I verified the partner group, roles and app permissions. Replace this app's customer grants and recheck access.</span></label>
      <Button type="submit" variant="outline" disabled={pending} className="w-fit">Repair application access</Button>
    </form> : null}
    {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
  </div>
}
