"use client"
import { useRef } from "react"
import type { Control, UseFormSetValue, UseFormGetValues } from "react-hook-form"
import { FormField, FormItem, FormControl, FormMessage } from "@siteinabox/ui/components/form"
import { Input } from "@siteinabox/ui/components/input"
import { cn } from "@siteinabox/ui/lib/utils"
import { slugify } from "@/lib/slugify"
import { useTranslations } from "next-intl"

export type PageMetaFormValues = {
  title: string
  slug: string
  status: "draft" | "published"
}

type Props = {
  control: Control<PageMetaFormValues>
  // FN-2026-0042 — auto-derive slug from title on Title onBlur, but ONLY
  // before the user has manually edited the slug. Caller passes set/get
  // bindings so we can read the current title + write a derived slug
  // without needing the entire form's useForm result.
  setValue?: UseFormSetValue<PageMetaFormValues>
  getValues?: UseFormGetValues<PageMetaFormValues>
}

/**
 * Tailwind classes for the floating error pill in the TopBar variant.
 * Anchored to the FormItem (which is `relative`), positioned just below
 * the input with `top-full mt-1.5`. Uses destructive styling so it reads
 * as an inline tooltip rather than a layout block. `pointer-events-none`
 * keeps it from intercepting clicks on the columns row beneath; the
 * border-b under the input is overlaid intentionally so the error
 * visually associates with the field rather than the columns area.
 *
 * Does NOT push layout: an absolutely-positioned grid child contributes
 * zero rows/cells in CSS Grid, so FormItem's `grid gap-2` collapses to
 * the input row only — header height stays constant.
 */
const FLOATING_ERROR_CLASS =
  "absolute top-full left-0 mt-1.5 z-20 max-w-xs px-2 py-1 rounded-md bg-destructive text-destructive-foreground !text-xs shadow-md whitespace-normal pointer-events-none"

/**
 * Card-less Title + Slug fields for the sticky TopBar in side-preview mode.
 * Omits FormLabel so the TopBar stays compact. FormMessage is included so
 * validation errors (e.g. slug regex failure) are still visible inline.
 *
 * Field names and Input props mirror the existing PageForm hidden-mode cards
 * exactly — no extra autoComplete or onBlur beyond what spread-field provides.
 */
export function PageMetaInline({ control, setValue, getValues }: Props) {
  const t = useTranslations("editor")
  // FN-2026-0042 — slug-touched ref persists across renders.
  const slugTouched = useRef(false)
  const onTitleBlur = () => {
    if (!setValue || !getValues) return
    if (slugTouched.current) return
    const currentSlug = getValues("slug")
    if (currentSlug && currentSlug !== "") return
    const derived = slugify(getValues("title") ?? "")
    if (derived) setValue("slug", derived, { shouldDirty: true, shouldValidate: true })
  }
  return (
    <div className="flex flex-1 min-w-0 items-end gap-3">
      <FormField
        control={control}
        name="title"
        render={({ field }) => (
          <FormItem className="relative flex-1 min-w-0">
            <FormControl>
              <Input
                placeholder={t("pageTitle")}
                {...field}
                value={field.value ?? ""}
                onBlur={(e) => {
                  field.onBlur()
                  onTitleBlur()
                  e.preventDefault?.()
                }}
              />
            </FormControl>
            <FormMessage className={FLOATING_ERROR_CLASS} />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="slug"
        render={({ field, fieldState }) => {
          // Wrap a real shadcn <Input> so we keep aria-invalid styling,
          // dark-mode bg, data-slot hooks etc. The leading `/` is rendered
          // as an absolutely-positioned overlay so the underlying input
          // owns all interaction (focus ring, selection, placeholder).
          // Wrapper-level mousedown forwards click-on-`/` to the input.
          const inputRef = useRef<HTMLInputElement | null>(null)
          return (
            <FormItem className="relative w-48 shrink-0">
              <FormControl>
                <div
                  className="relative"
                  title={t("slugTitle")}
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) {
                      e.preventDefault()
                      inputRef.current?.focus()
                    }
                  }}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-muted-foreground"
                  >
                    /
                  </span>
                  <Input
                    {...field}
                    ref={(el) => {
                      inputRef.current = el
                      if (typeof field.ref === "function") field.ref(el)
                    }}
                    placeholder="slug"
                    value={field.value ?? ""}
                    aria-invalid={fieldState.invalid || undefined}
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className={cn("pl-6")}
                    onChange={(e) => {
                      slugTouched.current = true
                      field.onChange(e)
                    }}
                  />
                </div>
              </FormControl>
              {/* Anchored to the slug FormItem (right-aligned so a long
                  message doesn't escape past the TopBar's right edge into
                  the splitter/preview area). */}
              <FormMessage className={cn(FLOATING_ERROR_CLASS, "left-auto right-0")} />
            </FormItem>
          )
        }}
      />
    </div>
  )
}
