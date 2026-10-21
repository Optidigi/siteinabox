import { getTranslations } from "next-intl/server"
import { CustomerIdentityError } from "@/lib/auth/verifiedCustomer"

export async function CustomerAccessNotice({ error }: { error: unknown }) {
  const t = await getTranslations("auth")
  const key = error instanceof CustomerIdentityError && error.code === "E_CUSTOMER_VERIFICATION_HISTORY_REQUIRED"
    ? "customerHistoryUnavailable" : "customerWorkspaceUnavailable"
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center p-6">
      <section role="alert" aria-labelledby="customer-access-title" className="space-y-4">
        <h1 id="customer-access-title" className="text-2xl font-semibold">{t("customerAccessTitle")}</h1>
        <p>{t(key)}</p>
        <a href="/login" className="inline-block font-semibold underline">{t("backToSignIn")}</a>
      </section>
    </main>
  )
}
