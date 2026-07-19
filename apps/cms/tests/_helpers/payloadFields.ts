import type { Field, Option as PayloadOption } from "payload"

export function findNamedField(fields: Field[] | undefined, name: string): Field | undefined {
  return fields?.find((field): field is Field & { name: string } => "name" in field && field.name === name)
}

export function expectNamedField(fields: Field[] | undefined, name: string): Field {
  const field = findNamedField(fields, name)
  if (!field) throw new Error(`Field "${name}" not found`)
  return field
}

export function findNamedSubField(fields: Field[] | undefined, name: string): Field | undefined {
  return findNamedField(fields, name)
}

export function fieldOptions(field: Field): PayloadOption[] | undefined {
  return "options" in field ? field.options : undefined
}

export function fieldRequired(field: Field): boolean {
  return "required" in field ? Boolean(field.required) : false
}

export function fieldValidator(field: Field): ((value: unknown, options: unknown) => unknown) | undefined {
  if (!("validate" in field) || typeof field.validate !== "function") return undefined
  return field.validate as (value: unknown, options: unknown) => unknown
}

export function fieldOptionValues(options: PayloadOption[] | undefined): string[] {
  return (options ?? []).map((option) => (typeof option === "string" ? option : String(option.value)))
}

export function filteredOptionValues(options: PayloadOption[] | undefined): string[] {
  return fieldOptionValues(options)
}

export type FieldAccessArgs = {
  req: Record<string, unknown>
  data?: unknown
  doc?: unknown
  siblingData?: unknown
}

export type FieldWithAccess = Field & {
  access: {
    create: (args: FieldAccessArgs) => unknown
    update: (args: FieldAccessArgs) => unknown
  }
}

export function expectAccessField(fields: Field[] | undefined, name: string): FieldWithAccess {
  return expectNamedField(fields, name) as FieldWithAccess
}
