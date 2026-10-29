"use client"
import { useActionState } from "react"
import { Button } from "@siteinabox/ui/components/button"
import { confirmCustomerMailOrder } from "./actions"

export function MailOrderConfirmation({ tenantId, runId, legalVersion, termsHref, privacyHref, manual, nl, additionalSeats, legalLocale, acceptanceStatement }: {
  tenantId: number; runId: number; legalVersion: string; termsHref: string; privacyHref: string; manual: boolean; nl: boolean; additionalSeats: boolean; legalLocale: "nl" | "en"; acceptanceStatement: string
}) {
  const [state, action, pending] = useActionState(confirmCustomerMailOrder, null)
  return <form action={action} className="grid gap-3">
    <input type="hidden" name="legalLocale" value={legalLocale} />
    <input type="hidden" name="tenantId" value={tenantId} />
    <input type="hidden" name="runId" value={runId} /><input type="hidden" name="legalVersion" value={legalVersion} />
    <p className="text-sm text-muted-foreground">{nl ? "Documenttaal" : "Legal document language"}: {legalLocale === "nl" ? "Nederlands" : "English"}.</p>
    <p className="text-sm"><a className="underline" href={termsHref} target="_blank" rel="noopener noreferrer">{nl ? "Voorwaarden" : "Terms"}</a> · <a className="underline" href={privacyHref} target="_blank" rel="noopener noreferrer">Privacy</a></p>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="acceptOrderTerms" required /><span><span lang={legalLocale}>{acceptanceStatement}</span>{" "}{additionalSeats
      ? (nl ? "Ik bevestig deze extra mailboxen tot het einde van de huidige looptijd." : "I confirm these additional mailboxes for the remainder of the current commitment.")
      : (nl ? "Ik bevestig deze zakelijke bestelling met een looptijd van één jaar." : "I confirm this business order with a one-year commitment.")}</span></label>
    <Button type="submit" className="w-fit" disabled={pending}>{pending ? (nl ? "Bevestigen…" : "Confirming…") : manual ? (nl ? "Bestelling bevestigen" : "Confirm order") : (nl ? "Betalen en e-mail instellen" : "Pay and set up email")}</Button>
    {state?.message ? <p role="status" className="text-sm text-destructive">{state.message}</p> : null}
  </form>
}
