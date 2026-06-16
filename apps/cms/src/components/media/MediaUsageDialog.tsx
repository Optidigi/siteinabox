"use client"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@siteinabox/ui/components/dialog"
import { useTranslations } from "next-intl"
import type { MediaPageRef } from "@/lib/queries/mediaUsageWalker"

/**
 * Read-only "Used in" listing for a single media item. Operators reach
 * this from the badge on each MediaGrid card. The dialog is purely
 * informational; deletion goes through TypedConfirmDialog separately.
 *
 * `pagesBaseHref` is the editor route prefix for this tenant context.
 * Omit it when the current role can see usage but cannot navigate to the
 * page editor route.
 */
export function MediaUsageDialog({
  open,
  onOpenChange,
  filename,
  pages,
  settings,
  pagesBaseHref
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  filename: string
  pages: MediaPageRef[]
  settings: boolean
  pagesBaseHref?: string | null
}) {
  const t = useTranslations("media")
  const total = pages.length + (settings ? 1 : 0)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("usageTitle", { count: total })}</DialogTitle>
          <DialogDescription>
            {t("usageDescription", { filename })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 text-sm">
          {pages.map((p) => {
            const content = (
              <>
                <span className="font-medium">{p.title}</span>
                {p.slug && <span className="text-muted-foreground"> /{p.slug}</span>}
              </>
            )
            return pagesBaseHref ? (
              <Link
                key={String(p.id)}
                href={`${pagesBaseHref}/${p.id}`}
                className="block rounded px-2 py-1 hover:bg-accent"
                onClick={() => onOpenChange(false)}
                aria-label={p.title}
              >
                {content}
              </Link>
            ) : (
              <div key={String(p.id)} className="rounded px-2 py-1">
                {content}
              </div>
            )
          })}
          {settings && (
            <div className="rounded px-2 py-1 text-muted-foreground">
              {t("settingsLogo")}
            </div>
          )}
          {total === 0 && (
            <div className="rounded px-2 py-1 text-muted-foreground">{t("notUsedAnywhere")}</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
