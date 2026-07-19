export type EditorFieldOption = {
  value: string
  label: string
}

export type EditorFieldAdmin = {
  description?: string
  placeholder?: string
  editor?: "richTextBlock" | "richTextInline" | string
}

/** Minimal Payload field shape consumed by the page editor FieldRenderer. */
export type EditorField = {
  type: string
  name?: string
  label?: string
  required?: boolean
  admin?: EditorFieldAdmin
  options?: EditorFieldOption[]
  relationTo?: string | string[]
  fields?: EditorField[]
  singularLabel?: string
}
