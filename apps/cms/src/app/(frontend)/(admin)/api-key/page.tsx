import { requireAuth } from "@/lib/authGate"
import { ApiKeyManager } from "@/components/forms/ApiKeyManager"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { getAdminTranslations } from "@/i18n/admin"

// AMD-3 — UI half of the honest-rejection fix. The server hook in
// src/collections/Users.ts now returns HTTP 403 on any non-super-admin
// PATCH that names apiKey/enableAPIKey/apiKeyIndex; rendering the manager
// for non-super-admin would put a button in front of a guaranteed 403, so
// instead we render a brief placeholder explaining the constraint. Super-
// admin path is unchanged.
export default async function ApiKeyPage() {
  const { user } = await requireAuth()
  const t = await getAdminTranslations(user, "apiKey")
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <PageHeader title={t("title")} />
      {user.role === "super-admin" ? (
        <ApiKeyManager user={user} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("superAdminOnlyTitle")}</CardTitle>
            <CardDescription>
              {t("superAdminOnlyDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t("restriction")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
