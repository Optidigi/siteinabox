"use client"
import { useFormContext, Controller } from "react-hook-form"
import type { Control } from "react-hook-form"
import { Input } from "@siteinabox/ui/components/input"
import { Textarea } from "@siteinabox/ui/components/textarea"
import { Switch } from "@siteinabox/ui/components/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@siteinabox/ui/components/select"
import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@siteinabox/ui/components/form"
import { MediaPicker } from "@/components/media/MediaPicker"
import { LexicalField } from "@/components/editor/richText/LexicalField"
import { useRtManifest } from "@/components/editor/RtManifestContext"
import { EMPTY_BLOCK, EMPTY_INLINE } from "@/lib/richText/RtNode"
import { useTranslations } from "next-intl"

type AnyField = any

// Extracted subcomponent so hooks are called at the top level of a component, not
// inside a render-prop callback. This satisfies the react-hooks/rules-of-hooks lint rule.
function RichTextFormField({
  field,
  fieldName,
  control,
  variant,
}: {
  field: AnyField
  fieldName: string
  control: Control
  variant: "block" | "inline"
}) {
  const manifest = useRtManifest()
  const empty = variant === "block" ? EMPTY_BLOCK : EMPTY_INLINE

  return (
    <FormField
      control={control}
      name={fieldName}
      render={({ field: f }) => (
        <FormItem>
          <FormLabel>
            {field.label ?? field.name}
            {field.required && "*"}
          </FormLabel>
          <FormControl>
            <LexicalField
              variant={variant}
              manifest={manifest}
              value={(f.value as any) ?? empty}
              onChange={(v) => f.onChange(v)}
              placeholder={(field.admin as any)?.placeholder}
            />
          </FormControl>
          {field.admin?.description && (
            <FormDescription>{field.admin.description}</FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function FieldRenderer({ field, namePrefix = "" }: { field: AnyField; namePrefix?: string }) {
  const t = useTranslations("editor")
  const fieldName = field.name ? (namePrefix ? `${namePrefix}.${field.name}` : field.name) : namePrefix
  const { control } = useFormContext()

  switch (field.type) {
    case "text":
    case "email":
    case "url":
    case "tel":
      return (
        <FormField control={control} name={fieldName} render={({ field: f }) => (
          <FormItem>
            <FormLabel>{field.label ?? field.name}{field.required && "*"}</FormLabel>
            <FormControl>
              {field.type === "email" ? (
                <Input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  {...f}
                  value={f.value ?? ""}
                />
              ) : field.type === "url" ? (
                <Input
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  {...f}
                  value={f.value ?? ""}
                />
              ) : field.type === "tel" ? (
                <Input
                  type="tel"
                  autoComplete="tel"
                  {...f}
                  value={f.value ?? ""}
                />
              ) : (
                <Input type="text" {...f} value={f.value ?? ""} />
              )}
            </FormControl>
            {field.admin?.description && <FormDescription>{field.admin.description}</FormDescription>}
            <FormMessage />
          </FormItem>
        )}/>
      )
    case "textarea":
    case "richText":
      return (
        <FormField control={control} name={fieldName} render={({ field: f }) => (
          <FormItem>
            <FormLabel>{field.label ?? field.name}{field.required && "*"}</FormLabel>
            <FormControl><Textarea rows={field.type === "richText" ? 8 : 4} {...f} value={f.value ?? ""} /></FormControl>
            <FormMessage />
          </FormItem>
        )}/>
      )
    case "number":
      return (
        <FormField control={control} name={fieldName} render={({ field: f }) => (
          <FormItem>
            <FormLabel>{field.label ?? field.name}</FormLabel>
            <FormControl><Input type="number" {...f} value={f.value ?? ""} onChange={(e) => f.onChange(e.target.valueAsNumber)} /></FormControl>
            <FormMessage />
          </FormItem>
        )}/>
      )
    case "checkbox":
      return (
        <FormField control={control} name={fieldName} render={({ field: f }) => (
          <FormItem className="flex items-center justify-between gap-3">
            <FormLabel>{field.label ?? field.name}</FormLabel>
            <FormControl><Switch checked={!!f.value} onCheckedChange={f.onChange} /></FormControl>
          </FormItem>
        )}/>
      )
    case "select":
      return (
        <FormField control={control} name={fieldName} render={({ field: f }) => (
          <FormItem>
            <FormLabel>{field.label ?? field.name}</FormLabel>
            <Select value={f.value ?? ""} onValueChange={f.onChange}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent data-siab-editor-ui>
                {field.options.map((opt: any) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}/>
      )
    case "upload":
      return (
        <Controller name={fieldName} control={control} render={({ field: f }) => (
          <FormItem>
            <FormLabel>{field.label ?? field.name}</FormLabel>
            <FormControl><MediaPicker value={f.value} onChange={f.onChange} relationTo={field.relationTo}/></FormControl>
            <FormMessage />
          </FormItem>
        )}/>
      )
    case "group":
      return (
        <fieldset className="rounded-md border p-3 space-y-3">
          <legend className="px-1 text-sm font-medium">{field.label ?? field.name}</legend>
          {field.fields.map((sub: AnyField, i: number) => (
            <FieldRenderer key={i} field={sub} namePrefix={fieldName} />
          ))}
        </fieldset>
      )
    case "array":
      return <ArrayFieldRenderer field={field} namePrefix={fieldName} />
    case "json": {
      const fieldEditor = (field.admin as any)?.editor
      if (fieldEditor === "richTextBlock" || fieldEditor === "richTextInline") {
        const variant = fieldEditor === "richTextBlock" ? "block" : "inline"
        return (
          <RichTextFormField
            field={field}
            fieldName={fieldName}
            control={control}
            variant={variant}
          />
        )
      }
      // Plain JSON field (no editor annotation) — defensive fallback, none exist today.
      return <div className="text-xs text-muted-foreground">{t("jsonField", { name: field.name })}</div>
    }
    default:
      return <div className="text-xs text-muted-foreground">{t("unsupportedFieldType", { type: String(field.type) })}</div>
  }
}

function ArrayFieldRenderer({ field, namePrefix }: { field: any; namePrefix: string }) {
  const t = useTranslations("editor")
  const { getValues, setValue } = useFormContext()
  const items: any[] = getValues(namePrefix) ?? []

  const append = () => setValue(namePrefix, [...items, {}], { shouldDirty: true })
  const removeAt = (i: number) => setValue(namePrefix, items.filter((_, j) => j !== i), { shouldDirty: true })

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">{field.label ?? field.name}</div>
      {items.map((_, i) => (
        <div key={i} className="rounded-md border p-3 max-md:p-2 max-md:space-y-2 space-y-3 relative">
          <button type="button" className="absolute top-2 right-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => removeAt(i)}>{t("remove")}</button>
          {field.fields.map((sub: any, j: number) => (
            <FieldRenderer key={j} field={sub} namePrefix={`${namePrefix}.${i}`} />
          ))}
        </div>
      ))}
      <button type="button" className="text-xs text-primary underline" onClick={append}>+ {t("addItem", { item: field.singularLabel ?? "item" })}</button>
    </div>
  )
}
