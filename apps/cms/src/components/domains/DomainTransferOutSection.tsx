"use client"

import { useActionState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button } from "@siteinabox/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"

import {
  confirmDomainTransferCompletedAction,
  markDomainTransferOutStartedAction,
  requestDomainTransferOutAction,
  revealDomainTransferOutCodeAction,
  type RevealDomainTransferState,
} from "@/app/(frontend)/(admin)/settings/actions"

export type DomainTransferOutView = {
  id: string
  domainName: string
  custodyStatus: string
  transferOutCodeDeliveryStatus?: string | null
}

export function DomainTransferOutSection({
  domain,
  result,
  sectionId = "domain-transfer",
}: {
  domain: DomainTransferOutView | null
  result?: string
  sectionId?: string
}) {
  const [reveal, revealAction, revealing] = useActionState<
    RevealDomainTransferState,
    FormData
  >(revealDomainTransferOutCodeAction, {})
  if (!domain) return null
  const canRequest = domain.custodyStatus === "managed"
  const canReveal =
    domain.transferOutCodeDeliveryStatus === "provider_returned" &&
    ["transfer_code_ready", "transfer_pending"].includes(domain.custodyStatus)
  const canStart = domain.custodyStatus === "transfer_code_ready"
  const canConfirm = domain.custodyStatus === "transfer_pending"
  return (
    <Card id={sectionId} className="w-full max-w-3xl scroll-mt-20">
      <CardHeader>
        <CardTitle>Domein verhuizen</CardTitle>
        <CardDescription>
          Het domein blijft van jou. DNS, e-mail en de website blijven actief
          tijdens de verhuizing.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {result && (
          <Alert variant={result === "failed" ? "destructive" : "default"}>
            <AlertTitle>
              {result === "failed" ? "Verhuizing niet bijgewerkt" : "Verhuisstatus bijgewerkt"}
            </AlertTitle>
            <AlertDescription>
              {result === "confirmation-required"
                ? "Bevestig eerst de vereiste verklaring."
                : "De actuele status staat hieronder."}
            </AlertDescription>
          </Alert>
        )}
        <div className="flex items-center justify-between gap-3 rounded-md border p-4">
          <span className="font-medium">{domain.domainName}</span>
          <Badge variant="outline">{domain.custodyStatus}</Badge>
        </div>
        {canRequest && (
          <form action={requestDomainTransferOutAction} className="grid gap-3">
            <input type="hidden" name="managedDomainId" value={domain.id} />
            <Label htmlFor="domain-transfer-reason">Reden voor verhuizing</Label>
            <Input
              id="domain-transfer-reason"
              name="reason"
              required
              maxLength={1_000}
            />
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="preserveServices"
                value="confirmed"
                required
              />
              Ik begrijp dat Siteinabox de huidige DNS-, e-mail- en
              websiteconfiguratie behoudt totdat de verhuizing is bevestigd.
            </label>
            <Button type="submit" variant="outline" className="w-fit">
              Verhuiscode aanvragen
            </Button>
          </form>
        )}
        {canReveal && (
          <form action={revealAction} className="grid gap-3">
            <input type="hidden" name="managedDomainId" value={domain.id} />
            <Button type="submit" variant="outline" className="w-fit" disabled={revealing}>
              {revealing ? "Verhuiscode ophalen…" : "Verhuiscode tonen"}
            </Button>
            {reveal.authCode && (
              <output
                aria-label="Verhuiscode"
                className="break-all rounded-md border bg-muted p-3 font-mono"
              >
                {reveal.authCode}
              </output>
            )}
            {reveal.error && (
              <p role="alert" className="text-sm text-destructive">
                De verhuiscode is nog niet beschikbaar.
              </p>
            )}
          </form>
        )}
        {domain.transferOutCodeDeliveryStatus === "registrant_email" && (
          <Alert>
            <AlertTitle>Verhuiscode is naar de domeinhouder gestuurd</AlertTitle>
            <AlertDescription>
              OpenProvider of het register heeft de code naar het e-mailadres
              van de domeinhouder gestuurd. Gebruik die code bij de nieuwe
              registrar; Siteinabox bewaart of toont deze code niet.
            </AlertDescription>
          </Alert>
        )}
        {canStart && (
          <form action={markDomainTransferOutStartedAction}>
            <input type="hidden" name="managedDomainId" value={domain.id} />
            <Button type="submit" variant="outline">Ik heb de verhuizing gestart</Button>
          </form>
        )}
        {canConfirm && (
          <form action={confirmDomainTransferCompletedAction} className="grid gap-3">
            <input type="hidden" name="managedDomainId" value={domain.id} />
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="transferCompleted"
                value="confirmed"
                required
              />
              Ik bevestig dat de ontvangende registrar de verhuizing als
              voltooid toont.
            </label>
            <Button type="submit" variant="outline" className="w-fit">
              Voltooiing bevestigen
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
