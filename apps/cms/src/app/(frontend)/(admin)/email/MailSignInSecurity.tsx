import { Button } from "@siteinabox/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import type { SignInPolicy } from "@/lib/microsoftMailProvisioning/signInPolicy"
import { requestCustomerMailSignInMode } from "./actions"

/** Tenant-wide Microsoft sign-in setting; never shows provider codes or Microsoft admin steps. */
export function MailSignInSecurity({ tenantId, policy, nl }: { tenantId: number; policy: SignInPolicy; nl: boolean }) {
  // Siteinabox has not confirmed the setting with Microsoft yet: nothing to toggle.
  if (!policy.observedAt) return <Card>
    <CardHeader><CardTitle>{nl ? "Aanmelden" : "Sign-in"}</CardTitle></CardHeader>
    <CardContent className="text-sm"><p role="status" className="text-muted-foreground">{nl ? "Siteinabox stelt het aanmelden voor je accounts nog in." : "Siteinabox is still setting up sign-in for your accounts."}</p></CardContent>
  </Card>
  const applying = Date.parse(policy.desiredAt) > Date.parse(policy.observedAt)
  // Show what Microsoft actually enforces, not only what was requested.
  const twoStep = policy.securityDefaults === "unknown" ? policy.desired === "two_step" : policy.securityDefaults === "on"
  return <Card>
    <CardHeader><CardTitle>{nl ? "Aanmelden" : "Sign-in"}</CardTitle></CardHeader>
    <CardContent className="grid gap-3 text-sm">
      {twoStep
        ? <p>{nl ? "Tweestapsaanmelding staat aan voor alle accounts. Bij de volgende aanmelding stelt iedereen de Microsoft Authenticator-app in op de eigen telefoon." : "Two-step sign-in is on for all accounts. At their next sign-in, everyone sets up the Microsoft Authenticator app on their own phone."}</p>
        : <p>{nl ? "Je accounts melden zich aan met alleen e-mailadres en wachtwoord. Wil je extra beveiliging? Zet tweestapsaanmelding aan. Dit geldt voor alle accounts: iedereen stelt dan bij de volgende aanmelding de Microsoft Authenticator-app in." : "Your accounts sign in with just their email address and password. Want extra protection? Turn on two-step sign-in. It applies to all accounts: everyone then sets up the Microsoft Authenticator app at their next sign-in."}</p>}
      {applying ? <p role="status" className="text-muted-foreground">{nl ? "Deze instelling wordt toegepast. Dit kan enkele minuten duren." : "This setting is being applied. This can take a few minutes."}</p> : null}
      {policy.issueCode && !applying ? <p role="status" className="text-muted-foreground">{nl ? "Siteinabox controleert deze instelling." : "Siteinabox is checking this setting."}</p> : null}
      <form action={requestCustomerMailSignInMode}>
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="mode" value={twoStep ? "password_only" : "two_step"} />
        <Button type="submit" variant="outline" className="w-fit">{twoStep
          ? (nl ? "Tweestapsaanmelding uitzetten" : "Turn off two-step sign-in")
          : (nl ? "Tweestapsaanmelding aanzetten" : "Turn on two-step sign-in")}</Button>
      </form>
    </CardContent>
  </Card>
}
