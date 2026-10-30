"use client"

import { useState } from "react"
import { Button } from "@siteinabox/ui/components/button"
import { Input } from "@siteinabox/ui/components/input"
import { revealMicrosoftMailboxSetupAction } from "./actions"

type Revealed = { userPrincipalName: string; password: string }

export function MailboxSetupReveal() {
  const [revealed, setRevealed] = useState<Revealed | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function reveal() {
    const token = window.location.hash.slice(1)
    if (!token) {
      setMessage("This setup link is missing its one-time token. Open the original message link again.")
      return
    }
    setPending(true)
    setMessage(null)
    const result = await revealMicrosoftMailboxSetupAction(token)
    window.history.replaceState(null, "", window.location.pathname)
    setPending(false)
    if (!result.ok) {
      setMessage(result.code === "SETUP_LINK_INVALID_EXPIRED_OR_USED"
        ? "This link has expired or was already used. Contact your Siteinabox administrator for a new setup link."
        : "Setup details are temporarily unavailable. Contact your Siteinabox administrator.")
      return
    }
    setRevealed({ userPrincipalName: result.userPrincipalName, password: result.password })
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setMessage("Copied.") }
    catch { setMessage("Copy is unavailable in this browser. Select and copy the value manually.") }
  }

  return <div className="grid gap-4">
    {!revealed ? <>
      <p>This one-time page shows the sign-in details for your new mailbox. The link expires after 48 hours and can be used once.</p>
      <Button type="button" className="w-fit" disabled={pending} onClick={reveal}>{pending ? "Opening secure setup…" : "Show mailbox sign-in details"}</Button>
    </> : <>
      <p>Your temporary password is shown once. Microsoft will ask you to change it after sign-in.</p>
      <div className="grid gap-2">
        <label htmlFor="mailbox-setup-upn" className="text-sm font-medium">Mailbox sign-in</label>
        <div className="flex gap-2"><Input id="mailbox-setup-upn" readOnly value={revealed.userPrincipalName} /><Button type="button" variant="outline" onClick={() => copy(revealed.userPrincipalName)}>Copy</Button></div>
      </div>
      <div className="grid gap-2">
        <label htmlFor="mailbox-setup-password" className="text-sm font-medium">Temporary password</label>
        <div className="flex gap-2"><Input id="mailbox-setup-password" readOnly type={showPassword ? "text" : "password"} value={revealed.password} /><Button type="button" variant="outline" onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? "Hide" : "Show"}</Button><Button type="button" variant="outline" onClick={() => copy(revealed.password)}>Copy</Button></div>
      </div>
      <Button asChild className="w-fit"><a href={`https://outlook.office.com/mail/?login_hint=${encodeURIComponent(revealed.userPrincipalName)}`} rel="noopener noreferrer">Open Outlook on the web</a></Button>
    </>}
    {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
  </div>
}
