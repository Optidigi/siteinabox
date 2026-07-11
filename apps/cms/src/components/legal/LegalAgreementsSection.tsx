import Link from "next/link"
import { CheckCircle2, ChevronDown, ExternalLink, FileCheck2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button } from "@siteinabox/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@siteinabox/ui/components/collapsible"
import type { CustomerLegalAcceptance, CustomerLegalRequirement } from "@/lib/legal/customerRequirements"
import { acceptLegalRequirementAction, objectLegalRequirementAction } from "@/app/(frontend)/(admin)/settings/actions"

const formatDate = (value: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(value))

export function LegalAgreementsSection({
  requirements,
  acceptanceHistory,
  locale,
  result,
}: {
  requirements: CustomerLegalRequirement[]
  acceptanceHistory: CustomerLegalAcceptance[]
  locale: string
  result?: string
}) {
  const acceptanceRequirements = requirements.filter((item) => item.requiresAcceptance || item.action === "notice_and_continued_use")
  const notices = requirements.filter((item) => !item.requiresAcceptance && item.action !== "notice_and_continued_use")
  const en = locale.startsWith("en")

  return (
    <Card id="agreements" className="w-full max-w-3xl scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl"><FileCheck2 className="size-5" /> {en ? "Agreements and notices" : "Overeenkomsten en kennisgevingen"}</CardTitle>
        <CardDescription>{en ? "Review legal changes and accept updated terms when required." : "Bekijk juridische wijzigingen en accepteer bijgewerkte voorwaarden wanneer dat nodig is."}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {result === "accepted" && (
          <Alert><CheckCircle2 /><AlertTitle>{en ? "Terms accepted" : "Voorwaarden geaccepteerd"}</AlertTitle><AlertDescription>{en ? "Your acceptance has been recorded." : "Je acceptatie is vastgelegd."}</AlertDescription></Alert>
        )}
        {result === "objected" && (
          <Alert><CheckCircle2 /><AlertTitle>{en ? "Objection recorded" : "Bezwaar geregistreerd"}</AlertTitle><AlertDescription>{en ? "Site in a Box will contact you about the next steps." : "Site in a Box neemt contact met je op over de vervolgstappen."}</AlertDescription></Alert>
        )}
        {result === "failed" && (
          <Alert variant="destructive"><AlertTitle>Acceptatie niet opgeslagen</AlertTitle><AlertDescription>Probeer het opnieuw. Neem contact op met Site in a Box als dit blijft gebeuren.</AlertDescription></Alert>
        )}
        {result === "acceptance-required" && (
          <Alert variant="destructive"><AlertTitle>Bevestiging vereist</AlertTitle><AlertDescription>Vink de bevestiging aan voordat je accepteert.</AlertDescription></Alert>
        )}

        {!requirements.length && (
          <div className="flex items-start gap-3 rounded-md border p-4">
            <CheckCircle2 className="mt-0.5 size-5 text-muted-foreground" />
            <div><p className="font-medium">{en ? "Everything is up to date" : "Alles is bijgewerkt"}</p><p className="text-sm text-muted-foreground">{en ? "There are no outstanding legal actions." : "Er zijn geen openstaande juridische acties."}</p></div>
          </div>
        )}

        {acceptanceRequirements.map((requirement) => (
          <section key={requirement.requirementKey} className="grid gap-4 rounded-md border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-1">
                <h3 className="font-medium">{en ? "Terms and conditions" : "Algemene voorwaarden"}</h3>
                <p className="text-sm text-muted-foreground">
                  {requirement.isInitialRelease
                    ? (en ? "These terms apply to your use of Site in a Box. Review and accept them to continue using the service." : "Deze voorwaarden gelden voor je gebruik van Site in a Box. Bekijk en accepteer ze om de dienstverlening te blijven gebruiken.")
                    : requirement.changeSummary}
                </p>
              </div>
              <Badge
                variant="outline"
                className={requirement.requiresAcceptance
                  ? "rounded-sm border-warning bg-transparent px-2.5 py-1 text-warning"
                  : "rounded-sm px-2.5 py-1"}
              >
                {requirement.action === "notice_and_continued_use" ? "Kennisgeving" : "Acceptatie vereist"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Van kracht vanaf {formatDate(requirement.effectiveAt, locale)}
              {requirement.objectionDeadlineAt ? `; bezwaar mogelijk tot ${formatDate(requirement.objectionDeadlineAt, locale)}` : requirement.enforceAt ? `; expliciete acceptatie vereist voor ${formatDate(requirement.enforceAt, locale)}` : ""}.
            </p>
            <Button asChild variant="outline" className="w-fit">
              <Link href={requirement.href} target="_blank" rel="noopener noreferrer">
                Document bekijken <ExternalLink className="size-4" />
              </Link>
            </Button>
            <form action={acceptLegalRequirementAction} className="grid gap-4 border-t pt-4">
              <input type="hidden" name="requirementId" value={requirement.id} />
              {requirement.requiresAcceptance ? (
                <label className="flex items-start gap-3 text-sm leading-6">
                  <input name="acceptance" value="accepted" type="checkbox" className="mt-1 size-4 rounded border-input accent-primary" required />
                  <span>Ik ga akkoord met de bijgewerkte algemene voorwaarden van Site in a Box.</span>
                </label>
              ) : <input type="hidden" name="acceptance" value="accepted" />}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" className="w-fit">Akkoord</Button>
                {requirement.canObject && (
                  <Button formAction={objectLegalRequirementAction} name="objection" value="confirmed" type="submit" variant="outline">Bezwaar registreren</Button>
                )}
              </div>
            </form>
          </section>
        ))}

        {notices.map((requirement) => (
          <section key={requirement.requirementKey} className="flex flex-wrap items-start justify-between gap-4 rounded-md border p-4">
            <div className="grid gap-1"><h3 className="font-medium">Juridische kennisgeving</h3><p className="text-sm text-muted-foreground">{requirement.changeSummary}</p></div>
            <Button asChild size="sm" variant="outline"><Link href={requirement.href}>Bekijken</Link></Button>
          </section>
        ))}
        {acceptanceHistory.length > 0 && (
          <Collapsible className="group border-t pt-5">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-md px-1 py-2 text-left font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <span>{en ? "Acceptance history" : "Acceptatiegeschiedenis"} ({acceptanceHistory.length})</span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="divide-y rounded-md border">
              {acceptanceHistory.map((acceptance) => (
                <div key={acceptance.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                  <div>
                    <p className="font-medium">{en ? "Terms" : "Voorwaarden"} {acceptance.documentVersion}</p>
                    <p className="text-muted-foreground">{formatDate(acceptance.acceptedAt, locale)} · {acceptance.actorEmail}</p>
                  </div>
                  <Button asChild size="sm" variant="ghost"><Link href={acceptance.href} target="_blank" rel="noopener noreferrer">{en ? "View" : "Bekijken"}</Link></Button>
                </div>
              ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  )
}
