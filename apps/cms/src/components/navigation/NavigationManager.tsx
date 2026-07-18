"use client"
import * as React from "react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { ArrowLeft, Plus, ListTree, PanelTop, PanelBottom } from "lucide-react"
import { SegmentedPill } from "@/components/common/segmented-pill"
import { FLOATING_PILL_CLASS } from "@/components/editor/floating-pill"
import { Button } from "@siteinabox/ui/components/button"
import { SaveButton } from "@/components/save-ui/save-button"
import { SaveStatusBar, type SaveStatus } from "@/components/save-ui/save-status-bar"
import { MobileSavePill } from "@/components/save-ui/mobile-save-pill"
import { MobileBackPill } from "@/components/common/mobile-back-pill"
import { useIsMobile } from "@siteinabox/ui/hooks/use-mobile"
import { useRouter } from "next/navigation"
import { EmptyState } from "@/components/empty-state"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { UnsavedChangesDialog } from "@/components/save-ui/unsaved-changes-dialog"
import { useNavigationGuard } from "@/components/editor/useNavigationGuard"
import { updateNav } from "@/lib/actions/updateNav"
import { cn } from "@siteinabox/ui/lib/utils"
import { NavEntryRow, describeEntry } from "./NavEntryRow"
import { NavEntryDialog } from "./NavEntryDialog"
import type { NavEntry, NavPageOption, NavZone } from "./navTypes"
import { useTranslations } from "next-intl"
import { deriveSaveStatus } from "@/lib/deriveSaveStatus"

type Keyed = { key: string; entry: NavEntry }

const keyed = (entry: NavEntry): Keyed => ({ key: crypto.randomUUID(), entry })
const entriesOf = (list: Keyed[]) => list.map((k) => k.entry)
// FE-58 — count the entry positions that differ between a live menu and its
// saved baseline, so the save badge climbs per change instead of sticking at
// "N menus changed". A reorder/removal can over-count slightly — acceptable
// for a rough unsaved-changes hint. Also doubles as the dirty check (> 0).
const countEntryDiff = (a: NavEntry[], b: NavEntry[]): number => {
  let n = 0
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) n++
  }
  return n
}

export function NavigationManager({
  tenantId,
  initialNavHeader,
  initialNavFooter,
  pages,
  initialZone = "header",
}: {
  tenantId: number | string
  initialNavHeader: NavEntry[]
  initialNavFooter: NavEntry[]
  pages: NavPageOption[]
  initialZone?: NavZone
}) {
  const t = useTranslations("navigation")
  const tCommon = useTranslations("common")
  const [header, setHeader] = React.useState<Keyed[]>(() => initialNavHeader.map(keyed))
  const [footer, setFooter] = React.useState<Keyed[]>(() => initialNavFooter.map(keyed))
  // Saved baseline — dirtiness is derived by comparing live state against it,
  // and it advances on a successful save (so the Save button settles).
  const [savedHeader, setSavedHeader] = React.useState<NavEntry[]>(initialNavHeader)
  const [savedFooter, setSavedFooter] = React.useState<NavEntry[]>(initialNavFooter)
  const [zone, setZone] = React.useState<NavZone>(initialZone)
  const [saving, setSaving] = React.useState(false)
  const [dialog, setDialog] = React.useState<{ open: boolean; editKey: string | null }>({
    open: false,
    editKey: null,
  })
  const [deleteKey, setDeleteKey] = React.useState<string | null>(null)
  const [showSaved, setShowSaved] = React.useState(false)
  const [saveFailed, setSaveFailed] = React.useState(false)
  const router = useRouter()
  const isMobile = useIsMobile()

  // Per-menu dirtiness — drives the Save button's amber border + count badge,
  // exactly like PublishControls counts unsaved field changes in the editor.
  const dirtyCount =
    countEntryDiff(entriesOf(header), savedHeader) +
    countEntryDiff(entriesOf(footer), savedFooter)
  const isDirty = dirtyCount > 0

  React.useEffect(() => {
    if (isDirty) setShowSaved(false)
  }, [isDirty])

  const guard = useNavigationGuard(isDirty || saving)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const list = zone === "header" ? header : footer
  const setList = zone === "header" ? setHeader : setFooter

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = list.findIndex((k) => k.key === active.id)
    const to = list.findIndex((k) => k.key === over.id)
    if (from < 0 || to < 0) return
    setList(arrayMove(list, from, to))
  }

  const editEntry = dialog.editKey
    ? list.find((k) => k.key === dialog.editKey)?.entry ?? null
    : null

  const onDialogSubmit = (entry: NavEntry) => {
    if (dialog.editKey) {
      setList(list.map((k) => (k.key === dialog.editKey ? { ...k, entry } : k)))
    } else {
      setList([...list, keyed(entry)])
    }
  }

  const deleteTarget = deleteKey ? list.find((k) => k.key === deleteKey) : undefined

  const save = async () => {
    if (!isDirty || saving) return
    setSaving(true)
    setSaveFailed(false)
    try {
      const h = entriesOf(header)
      const f = entriesOf(footer)
      await updateNav(tenantId, { navHeader: h, navFooter: f })
      setSavedHeader(h)
      setSavedFooter(f)
      setShowSaved(true)
    } catch {
      setSaveFailed(true)
    } finally {
      setSaving(false)
    }
  }

  const goBack = () => router.back()
  // Save-affordance status — mirrors the page editor's saveStatus machine.
  const saveStatus: SaveStatus = deriveSaveStatus({
    pending: saving,
    hasError: saveFailed,
    isDirty,
    showSaved,
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar row — zone switch (left) + Save (right). The switch copies
          the editor's ModeBar treatment: a SegmentedPill inside the shared
          FLOATING_PILL_CLASS surface. Rendered inline here rather than fixed. */}
      <div className="flex items-center justify-between gap-3">
        <div className={cn(FLOATING_PILL_CLASS, "inline-flex")}>
          <SegmentedPill<NavZone>
            ariaLabel={t("menu")}
            value={zone}
            onValueChange={(next) => next && setZone(next)}
            allowDeselect={false}
            items={[
              { value: "header", label: `${t("header")} (${header.length})`, icon: PanelTop, ariaLabel: t("headerAria") },
              { value: "footer", label: `${t("footer")} (${footer.length})`, icon: PanelBottom, ariaLabel: t("footerAria") },
            ]}
          />
        </div>

        {/* Back + Save — desktop. Phone gets the floating pills below. */}
        {!isMobile && (
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => guard.guardedNavigate(goBack)}>
              <ArrowLeft className="h-4 w-4" /> {tCommon("back")}
            </Button>
            <SaveButton
              type="button"
              onClick={save}
              pending={saving}
              isDirty={isDirty}
              dirtyCount={dirtyCount}
            />
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<ListTree className="size-10 text-muted-foreground" aria-hidden />}
          title={t("none", { zone: zone === "header" ? t("header").toLowerCase() : t("footer").toLowerCase() })}
          description={t("noneDescription")}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={list.map((k) => k.key)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {list.map((k) => (
                <NavEntryRow
                  key={k.key}
                  id={k.key}
                  entry={k.entry}
                  pages={pages}
                  onEdit={() => setDialog({ open: true, editKey: k.key })}
                  onDelete={() => setDeleteKey(k.key)}
                  labels={{
                    typeLabel: {
                      page: t("page"),
                      section: t("section"),
                      custom: t("link"),
                      group: t("group"),
                    },
                    untitledPage: t("untitledPage"),
                    pageNotFound: t("pageNotFound"),
                    untitledSection: t("untitledSection"),
                    untitledLink: t("untitledLink"),
                    notOnSite: t("notOnSite"),
                    drag: t("drag"),
                    edit: t("edit"),
                    delete: t("delete"),
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setDialog({ open: true, editKey: null })}
        >
          <Plus className="size-3.5" aria-hidden /> {t("addEntry")}
        </Button>
      </div>

      <NavEntryDialog
        open={dialog.open}
        initial={editEntry}
        pages={pages}
        onSubmit={onDialogSubmit}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />

      <ConfirmDialog
        open={deleteKey !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteKey(null)
        }}
        title={t("removeEntryTitle")}
        description={
          deleteTarget ? (
            <>
              {t("removeEntryDescription", {
                label: describeEntry(deleteTarget.entry, pages, {
                  untitledPage: t("untitledPage"),
                  pageNotFound: t("pageNotFound"),
                  untitledSection: t("untitledSection"),
                  untitledLink: t("untitledLink"),
                }).label,
                zone: zone === "header" ? t("header").toLowerCase() : t("footer").toLowerCase(),
              })}
            </>
          ) : (
            ""
          )
        }
        confirmLabel={t("removeEntry")}
        onConfirm={async () => {
          if (deleteKey) setList(list.filter((k) => k.key !== deleteKey))
        }}
      />

      <UnsavedChangesDialog
        open={guard.pending !== null}
        onCancel={guard.cancel}
        onConfirm={guard.confirm}
      />
      <SaveStatusBar status={saveStatus} onRetry={save} />
      {isMobile && (
        <>
          <MobileBackPill onBack={() => guard.guardedNavigate(goBack)} position="top-right" offset="3.75rem" />
          <MobileSavePill status={saveStatus} dirtyCount={dirtyCount} onSave={save} />
        </>
      )}
    </div>
  )
}
