"use client"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { Button } from "@siteinabox/ui/components/button"
import { Switch } from "@siteinabox/ui/components/switch"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Copy, Key } from "lucide-react"
import { parsePayloadError } from "@/lib/api"
import { useTranslations } from "next-intl"
import type { User } from "@/payload-types"
import { useStatusFeedback } from "@/components/status-feedback"

export function ApiKeyManager({ user }: { user: User }) {
  const t = useTranslations("apiKey")
  const status = useStatusFeedback()
  const [pending, setPending] = useState(false)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const enabled = user.enableAPIKey ?? false

  const generate = async (alsoEnable: boolean) => {
    setPending(true)
    const newKey = crypto.randomUUID()
    const body: Record<string, unknown> = { apiKey: newKey }
    if (alsoEnable) body.enableAPIKey = true
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    })
    setPending(false)
    if (!res.ok) {
      // FN-2026-0054 — parsed Payload error message instead of raw text slice
      const detail = await parsePayloadError(res)
      status.error(t("generateFailed", { message: detail.message }))
      return
    }
    // FN-2026-0001/0002 fix — surface the generated key IMMEDIATELY before
    // any further server interaction. The previous shape called
    // `router.refresh()` here, which re-fetched the /api-key server
    // component; Payload's apiKey rotation can invalidate the active
    // session JWT, so the refresh would redirect to /login mid-flight
    // and the revealedKey state was lost — the user never saw the key
    // they were supposed to copy. Now: we render the key-reveal card and
    // wait for the user to dismiss; the dismiss handler then does a full
    // `window.location.reload()` which re-validates auth cleanly (lands
    // on /login if the session is gone, otherwise re-renders /api-key
    // with the new enabled state).
    setRevealedKey(newKey)
  }

  const disable = async () => {
    setPending(true)
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enableAPIKey: false, apiKey: null })
    })
    setPending(false)
    if (!res.ok) {
      // FN-2026-0054 — parsed Payload error message instead of raw text slice
      const detail = await parsePayloadError(res)
      const msg = t("disableFailed", { message: detail.message })
      status.error(msg)
      throw new Error(msg)
    }
    status.success(t("disabledStatus"))
    // FN-2026-0003 fix — same reasoning as generate(): a hard reload
    // re-validates auth state from scratch. If Payload invalidated the
    // session JWT during this PATCH, the requireAuth() server check
    // redirects to /login; otherwise we get a clean /api-key page with
    // the disabled-state card.
    window.location.reload()
  }

  const dismiss = () => {
    setRevealedKey(null)
    // Re-validate auth after the user has copied the key. See generate()
    // for why router.refresh() is unsafe here.
    window.location.reload()
  }

  if (revealedKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("new")}</CardTitle>
          <CardDescription>{t("copyNow")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 rounded-md border bg-muted p-3">
            <Key className="h-4 w-4 shrink-0 text-muted-foreground"/>
            <code className="text-xs flex-1 break-all">{revealedKey}</code>
            <Button size="sm" variant="outline" type="button"
              onClick={() => { navigator.clipboard.writeText(revealedKey); status.success(t("copied")) }}>
              <Copy className="h-3 w-3"/>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Use as: <code>Authorization: users API-Key {revealedKey.slice(0, 8)}...</code>
          </p>
          <Button onClick={dismiss}>{t("done")}</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>
          {t("description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div className="flex flex-col">
            <span className="font-medium">{enabled ? t("enabled") : t("disabled")}</span>
            <span className="text-xs text-muted-foreground">
              {enabled
                ? t("activeDescription")
                : t("inactiveDescription")}
            </span>
          </div>
          {/* WCAG 4.1.2 — the visible "API key enabled/disabled" copy beside
              the Switch carries state, but the trigger itself needs a stable
              accessible name (current/desired state is conveyed via
              aria-checked, not via the name). */}
          <Switch
            aria-label="API key"
            checked={enabled}
            disabled={pending}
            onCheckedChange={(v) => v ? generate(true) : setConfirmOpen(true)}
          />
        </div>

        {enabled && (
          <Button variant="outline" onClick={() => generate(false)} disabled={pending}>
            <Key className="mr-2 h-4 w-4"/> {t("regenerate")}
          </Button>
        )}

        {enabled && (
          <p className="text-xs text-muted-foreground">
            {t("rotateDescription")}
          </p>
        )}
        {!enabled && (
          <p className="text-xs text-muted-foreground">
            {t("enableDescription")}
          </p>
        )}
      </CardContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("disableTitle")}
        description={
          <>
            {t("disableDescription")}
          </>
        }
        confirmLabel={t("disable")}
        variant="destructive"
        onConfirm={disable}
      />
    </Card>
  )
}
