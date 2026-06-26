export type ContactSectionProps = {
  title?: string | null
  description?: string | null
  formName: string
  fields: Array<{
    name: string
    label: string
    type: "text" | "email" | "tel" | "textarea"
    required?: boolean
  }>
  dataBlockIndex?: number  // set by PreviewIsland's PreactBlocks; absent in production
}

export default function ContactSection({
  title,
  description,
  formName,
  fields,
  dataBlockIndex,
}: ContactSectionProps) {
  if (!fields || fields.length === 0) return null
  return (
    <section class="cms-block cms-block--contact py-16 md:py-20" data-block-index={dataBlockIndex}>
      <div class="container mx-auto px-4 max-w-2xl">
        {title && (
          <h2 class="text-3xl md:text-4xl font-bold tracking-tight">{title}</h2>
        )}
        {description && (
          <p class="mt-3 text-lg text-muted-foreground">{description}</p>
        )}
        <form
          name={formName}
          method="POST"
          action="/api/forms"
          class="mt-8 space-y-4"
        >
          <input type="hidden" name="formName" value={formName} />
          {fields.map((field) => (
            <div key={field.name} class="space-y-1.5">
              <label
                htmlFor={`f-${field.name}`}
                class="block text-sm font-medium"
              >
                {field.label}
                {field.required && <span class="text-destructive"> *</span>}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  id={`f-${field.name}`}
                  name={field.name}
                  required={!!field.required}
                  rows={5}
                  class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              ) : (
                <input
                  id={`f-${field.name}`}
                  name={field.name}
                  type={field.type}
                  required={!!field.required}
                  class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              )}
            </div>
          ))}
          <button
            type="submit"
            class="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </section>
  )
}
