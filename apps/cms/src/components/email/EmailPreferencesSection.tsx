import { Bell, Mail } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Button } from "@siteinabox/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { getTranslations } from "next-intl/server"
import {
  updateMyCommunicationPreferencesAction,
  updateTenantNotificationSubscriptionAction,
} from "@/app/(frontend)/(admin)/settings/actions"

export type PersonalEmailPreferenceView = {
  marketing: boolean
  productNotifications: boolean
  locale: "nl" | "en"
  updatedAt?: string | null
}

export type TenantNotificationMemberView = {
  userId: string
  name: string
  email: string
  role: "owner" | "editor" | "viewer"
  categories: {
    formSubmissions: boolean
    publishingAndSiteStatus: boolean
    domainAndDns: boolean
    billingAndPayments: boolean
    teamAndAccess: boolean
  }
}

const categoryKeys = [
  "formSubmissions",
  "publishingAndSiteStatus",
  "domainAndDns",
  "billingAndPayments",
  "teamAndAccess",
] as const

function ResultAlert({ result, copy }: { result?: string; copy: { savedTitle: string; savedDescription: string; failedTitle: string; failedDescription: string; criticalDescription: string } }) {
  if (!result) return null
  const success = result === "personal-saved" || result === "notifications-saved"
  return (
    <Alert variant={success ? "default" : "destructive"}>
      <AlertTitle>{success ? copy.savedTitle : copy.failedTitle}</AlertTitle>
      <AlertDescription>{success ? copy.savedDescription : result === "critical-recipient-required" ? copy.criticalDescription : copy.failedDescription}</AlertDescription>
    </Alert>
  )
}

export async function EmailPreferencesSection({
  personal,
  members,
  canManageTenantNotifications,
  result,
}: {
  personal: PersonalEmailPreferenceView
  members: TenantNotificationMemberView[]
  canManageTenantNotifications: boolean
  result?: string
}) {
  const t = await getTranslations("emailPreferences")

  return (
    <div className="grid w-full max-w-3xl gap-4">
      <ResultAlert result={result} copy={{
        savedTitle: t("savedTitle"),
        savedDescription: t("savedDescription"),
        failedTitle: t("failedTitle"),
        failedDescription: t("failedDescription"),
        criticalDescription: t("criticalDescription"),
      }} />
      <Card id="email-preferences" className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl"><Mail className="size-5" /> {t("personalTitle")}</CardTitle>
          <CardDescription>{t("personalDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateMyCommunicationPreferencesAction} className="grid gap-5">
            <label className="flex items-start justify-between gap-4 rounded-md border p-4">
              <span className="grid gap-1">
                <span className="font-medium">{t("marketing")}</span>
                <span className="text-sm text-muted-foreground">{t("marketingDescription")}</span>
              </span>
              <input className="mt-1 size-4 accent-primary" type="checkbox" name="marketing" defaultChecked={personal.marketing} />
            </label>
            <label className="flex items-start justify-between gap-4 rounded-md border p-4">
              <span className="grid gap-1">
                <span className="font-medium">{t("productNotifications")}</span>
                <span className="text-sm text-muted-foreground">{t("productNotificationsDescription")}</span>
              </span>
              <input className="mt-1 size-4 accent-primary" type="checkbox" name="productNotifications" defaultChecked={personal.productNotifications} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium">{t("language")}</span>
              <select name="locale" defaultValue={personal.locale} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="nl">Nederlands</option>
                <option value="en">English</option>
              </select>
            </label>
            <p className="text-sm text-muted-foreground">{t("mandatoryDescription")}</p>
            {personal.updatedAt ? (
              <p className="text-xs text-muted-foreground">{t("lastUpdated", { date: new Date(personal.updatedAt).toLocaleString() })}</p>
            ) : null}
            <Button type="submit" className="w-fit">{t("savePersonal")}</Button>
          </form>
        </CardContent>
      </Card>

      {canManageTenantNotifications && (
        <Card id="tenant-notifications" className="scroll-mt-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl"><Bell className="size-5" /> {t("tenantTitle")}</CardTitle>
            <CardDescription>{t("tenantDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {members.map((member) => (
              <form key={member.userId} action={updateTenantNotificationSubscriptionAction} className="grid gap-4 rounded-md border p-4">
                <input type="hidden" name="userId" value={member.userId} />
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-sm text-muted-foreground">{member.email} · {t(`roles.${member.role}`)}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {categoryKeys.map((category) => (
                    <label key={category} className="flex items-start gap-3 text-sm">
                      <input className="mt-0.5 size-4 accent-primary" type="checkbox" name={category} defaultChecked={member.categories[category]} />
                      <span>{t(`categories.${category}`)}</span>
                    </label>
                  ))}
                </div>
                <Button type="submit" size="sm" variant="outline" className="w-fit">{t("saveMember", { name: member.name })}</Button>
              </form>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
