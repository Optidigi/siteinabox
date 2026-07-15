"use client"
import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@siteinabox/ui/components/dialog"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@siteinabox/ui/components/select"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { Switch } from "@siteinabox/ui/components/switch"
import { Button } from "@siteinabox/ui/components/button"
import { Plus, Trash2 } from "lucide-react"
import { emptyEntry, type NavEntry, type NavEntryType, type NavPageOption } from "./navTypes"
import { useTranslations } from "next-intl"

/** Per-type completeness check — mirrors the SiteSettings field validators. */
function isComplete(e: NavEntry): boolean {
  if (e.type === "page") return e.page != null
  if (e.type === "section") return e.page != null && !!e.anchor?.trim() && !!e.label?.trim()
  if (e.type === "group") return !!e.label?.trim() && e.children.length > 0 && e.children.length <= 6 && e.children.every((child) => !!child.label.trim() && !!child.href.trim())
  return !!e.url?.trim() && !!e.label?.trim()
}

export function NavEntryDialog({
  open,
  initial,
  pages,
  onSubmit,
  onOpenChange,
}: {
  open: boolean
  initial: NavEntry | null
  pages: NavPageOption[]
  onSubmit: (entry: NavEntry) => void
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("navigation")
  const tCommon = useTranslations("common")
  const [draft, setDraft] = React.useState<NavEntry>(() => initial ?? emptyEntry("page"))
  const typeOptions: { value: NavEntryType; label: string; hint: string }[] = [
    { value: "page", label: t("pageLink"), hint: t("pageHint") },
    { value: "section", label: t("sectionLink"), hint: t("sectionHint") },
    { value: "custom", label: t("customLink"), hint: t("customHint") },
    { value: "group", label: t("groupLink"), hint: t("groupHint") },
  ]

  // Re-seed the form each time the dialog opens (add → blank, edit → entry).
  React.useEffect(() => {
    if (open) setDraft(initial ?? emptyEntry("page"))
  }, [open, initial])

  const patch = (p: Partial<NavEntry>) => setDraft((d) => ({ ...d, ...p }))

  const onTypeChange = (type: NavEntryType) => {
    // Switching type clears fields that don't belong to the new type so a
    // stale `url`/`anchor` can't ride along to the server.
    setDraft({ ...emptyEntry(type), label: draft.label })
  }

  const selectedPage = pages.find((p) => p.id === draft.page)
  const anchorsForPage = selectedPage?.anchors ?? []

  const submit = () => {
    if (!isComplete(draft)) return
    onSubmit(draft)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? t("editEntry") : t("addEntryTitle")}</DialogTitle>
          <DialogDescription>
            {typeOptions.find((option) => option.value === draft.type)?.hint}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nav-type">{t("type")}</Label>
            <Select value={draft.type} onValueChange={(v) => onTypeChange(v as NavEntryType)}>
              <SelectTrigger id="nav-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(draft.type === "page" || draft.type === "section") && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nav-page">{t("page")}</Label>
              <Select
                value={draft.page != null ? String(draft.page) : ""}
                onValueChange={(v) => patch({ page: Number(v), anchor: null })}
              >
                <SelectTrigger id="nav-page">
                  <SelectValue placeholder={t("selectPage")} />
                </SelectTrigger>
                <SelectContent>
                  {pages.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.title}
                      {p.status !== "published" ? t("draftSuffix") : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {draft.type === "section" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nav-anchor">{t("section")}</Label>
              <Select
                value={draft.anchor ?? ""}
                onValueChange={(v) => patch({ anchor: v })}
                disabled={draft.page == null || anchorsForPage.length === 0}
              >
                <SelectTrigger id="nav-anchor">
                  <SelectValue
                    placeholder={
                      draft.page == null
                        ? t("pickPageFirst")
                        : anchorsForPage.length === 0
                          ? t("noSections")
                          : t("selectSection")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {anchorsForPage.map((a) => (
                    <SelectItem key={a} value={a}>
                      #{a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {draft.page != null && anchorsForPage.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("noAnchorsDescription")}
                </p>
              )}
            </div>
          )}

          {draft.type === "custom" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nav-url">{t("url")}</Label>
                <Input
                  id="nav-url"
                  value={draft.url ?? ""}
                  placeholder={t("urlPlaceholder")}
                  onChange={(e) => patch({ url: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="nav-external">{t("openNewTab")}</Label>
                <Switch
                  id="nav-external"
                  checked={draft.external}
                  onCheckedChange={(c) => patch({ external: c })}
                />
              </div>
            </>
          )}

          {draft.type === "group" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nav-description">{t("description")}</Label>
                <Input id="nav-description" maxLength={90} value={draft.description ?? ""} onChange={(event) => patch({ description: event.target.value || null })} />
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label>{t("groupLinks")}</Label>
                  <span className="text-xs text-muted-foreground">{draft.children.length}/6</span>
                </div>
                {draft.children.map((child, index) => (
                  <div className="rounded-md border p-3" key={`${index}-${child.href}`}>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input aria-label={t("label")} maxLength={32} placeholder={t("label")} value={child.label} onChange={(event) => patch({ children: draft.children.map((item, childIndex) => childIndex === index ? { ...item, label: event.target.value } : item) })} />
                      <Input aria-label={t("url")} placeholder={t("urlPlaceholder")} value={child.href} onChange={(event) => patch({ children: draft.children.map((item, childIndex) => childIndex === index ? { ...item, href: event.target.value } : item) })} />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Input className="flex-1" maxLength={90} placeholder={t("description")} value={child.description ?? ""} onChange={(event) => patch({ children: draft.children.map((item, childIndex) => childIndex === index ? { ...item, description: event.target.value || null } : item) })} />
                      <Select value={child.icon ?? "none"} onValueChange={(value) => patch({ children: draft.children.map((item, childIndex) => childIndex === index ? { ...item, icon: value === "none" ? null : value as typeof item.icon } : item) })}>
                        <SelectTrigger className="w-32" aria-label={t("icon")}><SelectValue /></SelectTrigger>
                        <SelectContent>{["none", "backpack", "cake-slice", "coffee", "grape", "hotel", "ice-cream", "map-pin", "package", "pizza", "plane", "sandwich", "smile"].map((icon) => <SelectItem key={icon} value={icon}>{icon}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={t("delete")} onClick={() => patch({ children: draft.children.filter((_, childIndex) => childIndex !== index) })}><Trash2 className="size-4" /></Button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <Label htmlFor={`nav-child-external-${index}`}>{t("openNewTab")}</Label>
                      <Switch id={`nav-child-external-${index}`} checked={child.external} onCheckedChange={(checked) => patch({ children: draft.children.map((item, childIndex) => childIndex === index ? { ...item, external: checked } : item) })} />
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" disabled={draft.children.length >= 6} onClick={() => patch({ children: [...draft.children, { label: "", href: "", description: null, icon: null, external: false }] })}><Plus className="size-4" />{t("addGroupLink")}</Button>
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nav-label">
              {t("label")}{draft.type === "page" ? ` (${tCommon("optional")})` : ""}
            </Label>
            <Input
              id="nav-label"
              value={draft.label ?? ""}
              placeholder={
                draft.type === "page"
                  ? selectedPage?.title || t("defaultsToPageTitle")
                  : t("displayText")
              }
              onChange={(e) => patch({ label: e.target.value })}
              maxLength={32}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button type="button" onClick={submit} disabled={!isComplete(draft)}>
            {initial ? t("saveEntry") : t("addEntry")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
