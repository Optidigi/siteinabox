import type { Metadata } from "next"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { Button } from "@siteinabox/ui/components/button"
import { verifyEmailPreferenceToken } from "@/lib/email/preferenceTokens"

export const metadata: Metadata = { title: "E-mailvoorkeuren" }
export const dynamic = "force-dynamic"

export default async function EmailPreferencesPage({ searchParams }: {
  searchParams: Promise<{ token?: string; status?: string }>
}) {
  const { token, status } = await searchParams
  let validManageToken = false
  if (token) {
    try {
      verifyEmailPreferenceToken(token, { requiredAction: "manage_preferences" })
      validManageToken = true
    } catch { /* rendered as invalid below */ }
  }
  return (
    <main className="flex min-h-[min(100vh,100dvh)] items-start justify-center px-4 pt-12 sm:items-center sm:p-6">
      <Card className="w-full max-w-lg">
        <CardHeader><CardTitle>E-mailvoorkeuren</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          {status === "unsubscribed" ? (
            <p>Je ontvangt geen marketing-e-mails meer van Site in a Box. Essentiële beveiligings-, service- en juridische berichten blijven mogelijk.</p>
          ) : status === "invalid" || !validManageToken ? (
            <p>Deze link is ongeldig of verlopen. Log in om je huidige voorkeuren te beheren.</p>
          ) : (
            <>
              <p>Marketing-e-mails zijn optioneel. Afmelden heeft geen invloed op noodzakelijke beveiligings-, service- of juridische berichten.</p>
              <form action="/api/email/preferences" method="post">
                <input type="hidden" name="token" value={token} />
                <Button type="submit" variant="destructive">Afmelden voor marketing-e-mails</Button>
              </form>
            </>
          )}
        </CardContent>
        <CardFooter className="border-t text-xs text-muted-foreground">
          Opnieuw aanmelden kan alleen met een nieuwe, expliciete keuze in je ingelogde instellingen.
        </CardFooter>
      </Card>
    </main>
  )
}
