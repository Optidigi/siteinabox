import Link from "next/link"
import { AlertTriangle, Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Button } from "@siteinabox/ui/components/button"
import type { CustomerLegalRequirement } from "@/lib/legal/customerRequirements"

export function LegalRequirementBanner({ requirements, canAccept, locale }: { requirements: CustomerLegalRequirement[]; canAccept: boolean; locale: string }) {
  if (!requirements.length) return null
  const primary = requirements.find((item) => item.requiresAcceptance) ?? requirements[0]!
  const urgent = primary.action === "mandatory_reaccept" && primary.overdue
  const en = locale.startsWith("en")

  return (
    <div className="border-b bg-background px-4 py-3 md:px-6">
      <Alert variant={urgent ? "warning" : "default"}>
        {urgent ? <AlertTriangle /> : <Info />}
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
          <Button asChild size="sm" variant={urgent ? "warning" : "outline"} className="mt-1 sm:mt-0 sm:self-end">
            <Link href={primary.requiresAcceptance && canAccept ? "/settings#agreements" : primary.href}>
              {primary.requiresAcceptance && canAccept
                ? (en ? "Review in settings" : "Bekijken in instellingen")
                : (en ? "View document" : "Document bekijken")}
            </Link>
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  )
}
