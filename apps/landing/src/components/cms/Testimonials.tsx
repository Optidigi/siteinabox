import SmoothImage from "./SmoothImage"

export type TestimonialsProps = {
  title?: string | null
  items: Array<{
    quote: string
    author: string
    role?: string | null
    avatarUrl?: string | null  // resolved by Blocks.astro
  }>
  dataBlockIndex?: number  // set by PreviewIsland's PreactBlocks; absent in production
}

export default function Testimonials({ title, items, dataBlockIndex }: TestimonialsProps) {
  if (!items || items.length === 0) return null
  return (
    <section class="cms-block cms-block--testimonials py-16 md:py-20 bg-muted/30" data-block-index={dataBlockIndex}>
      <div class="container mx-auto px-4">
        {title && (
          <h2 class="text-3xl md:text-4xl font-bold tracking-tight text-center mb-12">
            {title}
          </h2>
        )}
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, i) => (
            <figure
              key={i}
              class="rounded-lg border border-border bg-background p-6 flex flex-col"
            >
              <blockquote class="flex-1 text-base leading-relaxed">
                "{item.quote}"
              </blockquote>
              <figcaption class="mt-4 flex items-center gap-3">
                {item.avatarUrl && (
                  <SmoothImage
                    src={item.avatarUrl}
                    alt=""
                    class="h-10 w-10 rounded-full object-cover"
                  />
                )}
                <div>
                  <div class="font-semibold">{item.author}</div>
                  {item.role && (
                    <div class="text-sm text-muted-foreground">{item.role}</div>
                  )}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
