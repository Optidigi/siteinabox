export type FAQProps = {
  title?: string | null
  items: Array<{ question: string; answer: string }>
  dataBlockIndex?: number  // set by PreviewIsland's PreactBlocks; absent in production
}

export default function FAQ({ title, items, dataBlockIndex }: FAQProps) {
  if (!items || items.length === 0) return null
  return (
    <section class="cms-block cms-block--faq py-16 md:py-20" data-block-index={dataBlockIndex}>
      <div class="container mx-auto px-4 max-w-3xl">
        {title && (
          <h2 class="text-3xl md:text-4xl font-bold tracking-tight text-center mb-10">
            {title}
          </h2>
        )}
        <dl class="space-y-4">
          {items.map((item, i) => (
            <details
              key={i}
              class="rounded-lg border border-border bg-card p-4 group"
            >
              <summary class="cursor-pointer list-none flex items-center justify-between font-medium">
                <span>{item.question}</span>
                <span class="text-muted-foreground group-open:rotate-180 transition-transform" aria-hidden>
                  ▾
                </span>
              </summary>
              <div class="mt-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                {item.answer}
              </div>
            </details>
          ))}
        </dl>
      </div>
    </section>
  )
}
