"use client"
import { useActionState, type ReactNode } from "react"
import { Button } from "@siteinabox/ui/components/button"
import { saveCustomerPolicy } from "../actions"

export function PolicyForm({ children, nl }: { children: ReactNode; nl: boolean }) {
  const [state, action, pending] = useActionState(async (_previous: { ok: boolean; message: string } | null, form: FormData) => {
    try {
      await saveCustomerPolicy(form)
      return { ok: true, message: nl ? "Opgeslagen. Bestaande factuurafspraken zijn zo nodig gemarkeerd voor controle." : "Saved. Existing billing agreements are flagged for review where needed." }
    } catch {
      return { ok: false, message: nl ? "Niet opgeslagen. Controleer de reden en het domein. Rond een lopende e-mailbestelling af voordat je de dienst of het domein wijzigt." : "Not saved. Check the reason and domain. Complete any pending email order before changing its service or domain." }
    }
  }, null)
  return <form action={action} className="grid gap-4">{children}<Button type="submit" className="w-fit" disabled={pending}>{pending ? (nl ? "Opslaan…" : "Saving…") : (nl ? "Opslaan" : "Save policy")}</Button>{state ? <p role={state.ok ? "status" : "alert"} className="text-sm">{state.message}</p> : null}</form>
}
