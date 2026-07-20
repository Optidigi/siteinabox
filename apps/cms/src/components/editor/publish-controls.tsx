"use client"
import type { FieldValues } from "react-hook-form"
import type { Control } from "react-hook-form"
import { SaveButton } from "@/components/save-ui/save-button"
import { cn } from "@siteinabox/ui/lib/utils"

type Props = {
  control: Control<FieldValues>
  pending: boolean
  isDirty?: boolean
  errorCount?: number
  dirtyCount?: number
  variant?: "card" | "bare"
}

export function PublishControls({ pending, isDirty, errorCount, dirtyCount, variant = "card" }: Props) {
  return (
    <div className={cn(
      "flex items-end gap-2",
      variant === "bare" && "shrink-0"
    )}>
      <SaveButton pending={pending} isDirty={isDirty} errorCount={errorCount} dirtyCount={dirtyCount} />
    </div>
  )
}
