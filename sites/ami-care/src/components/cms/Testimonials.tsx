import SmoothImage from "./SmoothImage"
import { sectionAnalyticsAttrs } from "./analytics"
import type { AnalyticsBlockMetadata } from "../../lib/types"

export type TestimonialsProps = {
  title?: string | null
  items: Array<{
    quote: string
    author: string
    role?: string | null
    avatarUrl?: string | null
  }>
  anchor?: string | null
  dataBlockIndex?: number
  analytics?: AnalyticsBlockMetadata | null
}

export default function Testimonials({ title, items, anchor, dataBlockIndex, analytics }: TestimonialsProps) {
  if (!items || items.length === 0) return null
  return (
    <section
      id={anchor ?? undefined}
      class="cms-block cms-block--testimonials bg-secondary/40 px-6 py-16 @min-[48rem]/site-frame:px-12 @min-[48rem]/site-frame:py-20"
      data-block-index={dataBlockIndex}
      {...sectionAnalyticsAttrs(analytics, "testimonials", dataBlockIndex)}
    >
      <div class="container mx-auto">
        {title && (
          <h2
            class="mb-12 text-center font-serif text-[34px] leading-[1.1] tracking-[-0.01em] @min-[48rem]/site-frame:text-[44px]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {title}
          </h2>
        )}
        <div class="grid gap-6 @min-[48rem]/site-frame:grid-cols-2 @min-[64rem]/site-frame:grid-cols-3">
          {items.map((item, i) => (
            <figure
              key={i}
              class="flex flex-col rounded-lg border border-rule bg-card p-6"
            >
              <blockquote
                class="flex-1 font-serif text-[17px] italic leading-[1.5] text-ink"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                &ldquo;{item.quote}&rdquo;
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
                  <div
                    class="font-medium text-ink"
                    style={{ fontFamily: "var(--font-text)" }}
                  >
                    {item.author}
                  </div>
                  {item.role && (
                    <div
                      class="text-sm text-ink-muted"
                      style={{ fontFamily: "var(--font-text)" }}
                    >
                      {item.role}
                    </div>
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
