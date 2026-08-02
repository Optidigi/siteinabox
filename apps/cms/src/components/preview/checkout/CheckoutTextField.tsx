"use client"

import type { ComponentProps } from "react"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"

export function CheckoutTextField({
  id,
  name,
  label,
  value,
  error,
  description,
  onChange,
  ...inputProps
}: {
  id: string
  name?: string
  label: string
  value: string | undefined
  error?: string
  description?: string
  onChange?: (value: string) => void
} & Omit<ComponentProps<typeof Input>, "id" | "name" | "value" | "onChange">) {
  const describedBy = [
    description ? `${id}-description` : null,
    error ? `${id}-error` : null,
  ].filter(Boolean).join(" ") || undefined
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        {...inputProps}
        id={id}
        name={name}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      />
      {description && <p id={`${id}-description`} className="text-sm text-muted-foreground">{description}</p>}
      {error && <p id={`${id}-error`} className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  )
}
