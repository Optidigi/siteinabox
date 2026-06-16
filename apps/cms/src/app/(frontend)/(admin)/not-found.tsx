import Link from "next/link"
import { Button } from "@siteinabox/ui/components/button"
import { Compass } from "lucide-react"
import { getTranslations } from "next-intl/server"

/**
 * FN-2026-0023 + FN-2026-0025 — admin-segment not-found page. Rendered
 * by Next when any descendant route's `notFound()` fires (e.g. a
 * non-existent tenant slug or page id). Without this file Next would
 * render an empty body inside the admin shell, leaving the user with
 * sidebar + chrome but no content.
 *
 * Stays inside `(admin)/` so the AppSidebar + SiteHeader render around
 * the message — operator gets a clear "go back" path via the existing
 * sidebar nav AND an explicit "Back to Dashboard" button below.
 */
export default async function AdminNotFound() {
  const t = await getTranslations("notFound")
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <Compass className="size-10 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          {t("description")}
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/">{t("back")}</Link>
      </Button>
    </div>
  )
}
