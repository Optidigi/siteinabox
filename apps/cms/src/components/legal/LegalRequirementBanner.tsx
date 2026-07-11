import Link from "next/link"
import { Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Button } from "@siteinabox/ui/components/button"
import type { CustomerLegalRequirement } from "@/lib/legal/customerRequirements"
import { acceptLegalRequirementAction } from "@/app/(frontend)/(admin)/settings/actions"

export function LegalRequirementBanner({ requirements, canAccept, locale }: { requirements: CustomerLegalRequirement[]; canAccept: boolean; locale: string }) {
  if (!requirements.length) return null
  const primary = requirements.find((item) => item.requiresAcceptance) ?? requirements[0]!
  const en = locale.startsWith("en")
  const canConfirm = canAccept && (primary.requiresAcceptance || primary.action === "notice_and_continued_use")

  return (
    <div className="border-b bg-background px-4 py-3 md:px-6">
      <Alert>
        <Info />
        <AlertTitle className="line-clamp-none">
          {primary.requiresAcceptance
            ? (en ? "Updated terms require your attention" : "Bijgewerkte voorwaarden vragen je aandacht")
            : (en ? "Legal notice" : "Juridische kennisgeving")}
        </AlertTitle>
        <AlertDescription className="sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-x-4">
          <p>
            {primary.isInitialRelease
              ? (en ? "Our terms apply to your use of Site in a Box. Review and accept them to continue using Site in a Box." : "Onze algemene voorwaarden gelden voor het gebruik van Site in a Box. Bekijk en accepteer ze om Site in a Box te blijven gebruiken.")
              : primary.changeSummary || (en ? "Our legal terms have been updated." : "Onze juridische voorwaarden zijn bijgewerkt.")}
            {requirements.length > 1 ? (en ? ` ${requirements.length} notices are open.` : ` Er staan ${requirements.length} kennisgevingen open.`) : ""}
            {primary.requiresAcceptance && !canAccept ? (en ? " A site owner must accept the terms." : " Een eigenaar van deze website moet de voorwaarden accepteren.") : ""}
          </p>
          {canConfirm ? (
            <form action={acceptLegalRequirementAction} className="mt-2 flex items-center justify-end gap-2 sm:mt-0 sm:self-end">
              <input type="hidden" name="requirementId" value={primary.id} />
              <input type="hidden" name="acceptance" value="accepted" />
              <Button asChild size="sm" variant="ghost"><Link href="/settings#agreements">{en ? "View" : "Bekijken"}</Link></Button>
              <Button type="submit" size="sm">{en ? "Accept" : "Akkoord"}</Button>
            </form>
          ) : (
            <Button asChild size="sm" variant="outline" className="mt-1 sm:mt-0 sm:self-end">
              <Link href={primary.href}>{en ? "View document" : "Document bekijken"}</Link>
            </Button>
          )}
        </AlertDescription>
      </Alert>
    </div>
  )
}
