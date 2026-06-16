"use client"
import { useId } from "react"
import type { Control } from "react-hook-form"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@siteinabox/ui/components/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@siteinabox/ui/components/select"
import { SaveButton } from "@/components/save-ui/save-button"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"

type Props = {
  control: Control<any>
  pending: boolean
  isDirty?: boolean
  errorCount?: number
  dirtyCount?: number
  variant?: "card" | "bare"
}

/**
 * Publish controls — Status select + Save button. Used in two contexts:
 *   - variant="card"  → inside the Publish card in hidden/grid mode (shows "Status" label)
 *   - variant="bare"  → in the sticky TopBar in side mode (no label, compact)
 *
 * Field name "status" and option values "draft"/"published" mirror the zod
 * schema and existing inline JSX in PageForm.
 */
export function PublishControls({ control, pending, isDirty, errorCount, dirtyCount, variant = "card" }: Props) {
  const t = useTranslations("common")
  const tTable = useTranslations("table")
  // WCAG 4.1.2 — shadcn's FormControl forwards id/aria-describedby to a Radix
  // Select root, not its trigger button, so the SelectTrigger ends up with no
  // accessible name. We mint a stable id here, attach it to the FormLabel, and
  // point aria-labelledby on the trigger at the same id. The label stays in
  // the a11y tree on every variant; `sr-only` hides it visually in bare mode.
  const labelId = useId()
  return (
    <div className={cn(
      "flex items-end gap-2",
      variant === "bare" && "shrink-0"
    )}>
      <FormField
        control={control}
        name="status"
        render={({ field }) => (
          <FormItem className={cn("min-w-0", variant === "card" ? "flex-1" : "min-w-[140px]")}>
            <FormLabel id={labelId} className={cn(variant === "bare" && "sr-only")}>{tTable("status")}</FormLabel>
            <FormControl>
              <Select onValueChange={field.onChange} value={field.value ?? "draft"}>
                <SelectTrigger className="w-full" aria-labelledby={labelId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t("status.draft")}</SelectItem>
                  <SelectItem value="published">{t("status.published")}</SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            {variant === "card" && <FormMessage />}
          </FormItem>
        )}
      />
      {/* Canonical CMS save affordance shared by the page editor, navigation
          manager, and entity-edit forms. */}
      <SaveButton pending={pending} isDirty={isDirty} errorCount={errorCount} dirtyCount={dirtyCount} />
    </div>
  )
}
