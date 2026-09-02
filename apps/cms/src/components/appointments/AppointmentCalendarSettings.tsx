import type { User, Tenant } from "@/payload-types"
import { getPayload } from "payload"
import config from "@/payload.config"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Button } from "@siteinabox/ui/components/button"
import { CalendarDays, Check, ExternalLink, Unplug } from "lucide-react"
import { getAdminTranslations } from "@/i18n/admin"
import { appointmentCalendarProviderConfigured, type AppointmentCalendarProvider } from "@/lib/appointments/calendar"
import { recordText } from "@/lib/appointments/systemPayload"

const providers: AppointmentCalendarProvider[] = ["google", "microsoft"]

export async function AppointmentCalendarSettings({
  user,
  tenant,
  returnPath,
  result,
}: {
  user: User
  tenant: Tenant
  returnPath: string
  result?: string
}) {
  const t = await getAdminTranslations(user, "appointments")
  const payload = await getPayload({ config })
  const connections = await payload.find({
    collection: "appointment-calendar-connections",
    where: { tenant: { equals: tenant.id } },
    limit: 10,
    depth: 0,
    overrideAccess: true,
  })
  const connectionByProvider = new Map<string, typeof connections.docs[number]>()
  for (const connection of connections.docs) {
    const provider = recordText(connection, "provider")
    if (provider) connectionByProvider.set(provider, connection)
  }
  const canEdit = user.role === "owner" || user.role === "super-admin"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" aria-hidden />{t("calendarTitle")}</CardTitle>
        <CardDescription>{t("calendarDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {result === "connected" && <Alert variant="success"><AlertTitle>{t("calendarConnectedTitle")}</AlertTitle><AlertDescription>{t("calendarConnectedDescription")}</AlertDescription></Alert>}
        {result === "disconnected" && <Alert variant="success"><AlertTitle>{t("calendarDisconnectedTitle")}</AlertTitle><AlertDescription>{t("calendarDisconnectedDescription")}</AlertDescription></Alert>}
        {result === "error" && <Alert variant="destructive"><AlertTitle>{t("calendarErrorTitle")}</AlertTitle><AlertDescription>{t("calendarErrorDescription")}</AlertDescription></Alert>}
        {!canEdit && <Alert><AlertTitle>{t("readOnlyTitle")}</AlertTitle><AlertDescription>{t("calendarReadOnlyDescription")}</AlertDescription></Alert>}
        <div className="grid gap-3">
          {providers.map((provider) => {
            const connection = connectionByProvider.get(provider)
            const status = recordText(connection ?? { id: "" }, "status")
            const accountEmail = recordText(connection ?? { id: "" }, "accountEmail")
            const configured = appointmentCalendarProviderConfigured(provider)
            return (
              <div key={provider} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid gap-1">
                  <p className="font-medium">{provider === "google" ? "Google Calendar" : "Microsoft Outlook"}</p>
                  {status === "connected" && accountEmail ? (
                    <p className="flex items-center gap-1 text-sm text-muted-foreground"><Check className="h-4 w-4 text-green-600" aria-hidden />{accountEmail}</p>
                  ) : status === "reauth_required" ? (
                    <p className="text-sm text-amber-700 dark:text-amber-300">{t("calendarReauthRequired")}</p>
                  ) : !configured ? (
                    <p className="text-sm text-muted-foreground">{t("calendarNotConfigured")}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("calendarNotConnected")}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {canEdit && configured && (
                    <form method="post" action={`/api/appointments/calendar/${provider}/start`}>
                      <input type="hidden" name="tenantId" value={tenant.id} />
                      <input type="hidden" name="returnPath" value={returnPath} />
                      <Button type="submit" variant={status === "connected" ? "outline" : "default"}>
                        <ExternalLink className="mr-2 h-4 w-4" aria-hidden />{status === "connected" ? t("calendarReconnect") : t("calendarConnect")}
                      </Button>
                    </form>
                  )}
                  {canEdit && status && status !== "error" && (
                    <form method="post" action={`/api/appointments/calendar/${provider}/disconnect`}>
                      <input type="hidden" name="tenantId" value={tenant.id} />
                      <input type="hidden" name="returnPath" value={returnPath} />
                      <Button type="submit" variant="ghost"><Unplug className="mr-2 h-4 w-4" aria-hidden />{t("calendarDisconnect")}</Button>
                    </form>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">{t("calendarPrivacyNote")}</p>
      </CardContent>
    </Card>
  )
}
