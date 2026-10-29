"use client"
import { useActionState } from "react"
import { Button } from "@siteinabox/ui/components/button"
import { confirmCustomerMailOrder } from "./actions"

export function MailOrderConfirmation({ tenantId, runId, legalVersion, termsHref, privacyHref, manual, nl, additionalSeats }: {
  tenantId: number; runId: number; legalVersion: string; termsHref: string; privacyHref: string; manual: boolean; nl: boolean; additionalSeats: boolean
}) {
  const [state, action, pending] = useActionState(confirmCustomerMailOrder, null)
  return <form action={action} className="grid gap-3">
    <input type="hidden" name="tenantId" value={tenantId} />
    <input type="hidden" name="runId" value={runId} /><input type="hidden" name="legalVersion" value={legalVersion} />
    <p className="text-sm"><a className="underline" href={termsHref} target="_blank" rel="noopener noreferrer">{nl ? "Voorwaarden" : "Terms"}</a> · <a className="underline" href={privacyHref} target="_blank" rel="noopener noreferrer">Privacy</a></p>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="acceptOrderTerms" required /><span>{additionalSeats
      ? (nl ? "Ik accepteer de voorwaarden en bevestig deze extra mailboxen tot het einde van de huidige looptijd." : "I accept the terms and confirm these additional mailboxes for the remainder of the current commitment.")
      : (nl ? "Ik accepteer de voorwaarden en bevestig deze zakelijke bestelling met een looptijd van één jaar." : "I accept the terms and confirm this business order with a one-year commitment.")}</span></label>
    <Button type="submit" className="w-fit" disabled={pending}>{pending ? (nl ? "Bevestigen…" : "Confirming…") : manual ? (nl ? "Bestelling bevestigen" : "Confirm order") : (nl ? "Betalen en e-mail instellen" : "Pay and set up email")}</Button>
    {state?.message ? <p role="status" className="text-sm text-destructive">{state.message}</p> : null}
  </form>
}
