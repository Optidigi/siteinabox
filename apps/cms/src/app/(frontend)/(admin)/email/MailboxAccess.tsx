"use client"
import { useState, useTransition } from "react"
import { Button } from "@siteinabox/ui/components/button"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { revealCustomerMailboxCredential } from "./actions"

export function MailboxAccess({ tenantId, runId, address, nl }: { tenantId: number; runId: number; address: string; nl: boolean }) {
  const [password, setPassword] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState("")
  const [pending, startTransition] = useTransition()
  const reveal = () => startTransition(async () => {
    try {
      const result = await revealCustomerMailboxCredential({ tenantId, runId, userPrincipalName: address })
      if (result.ok) { setPassword(result.password); setMessage("") }
      else setMessage(result.message)
    } catch { setMessage(nl ? "De instelgegevens konden niet worden geopend. Probeer het opnieuw." : "Setup details could not be opened. Try again.") }
  })
  return <div className="grid gap-3 rounded-base border p-3">
    <p className="font-medium">{address}</p>
    {password ? <div className="grid gap-2">
      <Label htmlFor={`mailbox-password-${runId}-${address}`}>{nl ? "Tijdelijk wachtwoord" : "Temporary password"}</Label>
      <div className="flex gap-2"><Input id={`mailbox-password-${runId}-${address}`} readOnly type={visible ? "text" : "password"} value={password} autoComplete="off" /><Button type="button" variant="outline" onClick={() => setVisible(value => !value)}>{visible ? (nl ? "Verbergen" : "Hide") : (nl ? "Tonen" : "Show")}</Button></div>
      <p className="text-sm">{nl ? "Bewaar dit wachtwoord nu. Microsoft vraagt je het bij de eerste aanmelding te wijzigen. De instelgegevens kunnen één keer worden geopend, via deze pagina of de instelmail." : "Save this password now. Microsoft asks you to change it at first sign-in. Setup details can be opened once, through this page or the setup email."}</p>
    </div> : <Button type="button" variant="outline" disabled={pending} onClick={reveal}>{pending ? (nl ? "Openen…" : "Opening…") : (nl ? "Instelgegevens veilig openen" : "Securely open setup details")}</Button>}
    <Button asChild className="w-fit"><a href="https://outlook.office.com/mail/" target="_blank" rel="noopener noreferrer">{nl ? "Aanmelden bij Outlook" : "Sign in to Outlook"}</a></Button>
    {message ? <p role="status" className="text-sm">{message}</p> : null}
  </div>
}
