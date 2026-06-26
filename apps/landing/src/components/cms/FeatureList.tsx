import { resolveIcon } from "./icons"

export type FeatureListProps = {
  title?: string | null
  intro?: string | null
  features: Array<{
    title: string
    description?: string | null
    icon?: string | null
  }>
  dataBlockIndex?: number  // set by PreviewIsland's PreactBlocks; absent in production
}

export default function FeatureList({ title, intro, features, dataBlockIndex }: FeatureListProps) {
  if (!features || features.length === 0) return null
  return (
    <section class="cms-block cms-block--featurelist py-16 md:py-20" data-block-index={dataBlockIndex}>
      <div class="container mx-auto px-4">
        {(title || intro) && (
          <div class="text-center max-w-3xl mx-auto mb-12">
            {title && (
              <h2 class="text-3xl md:text-4xl font-bold tracking-tight">{title}</h2>
            )}
            {intro && (
              <p class="mt-4 text-lg text-muted-foreground">{intro}</p>
            )}
          </div>
        )}
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => {
            const Icon = resolveIcon(feature.icon)
            return (
              <div key={i} class="rounded-lg border border-border bg-card p-6">
                {Icon && <Icon size={28} class="text-primary mb-3" />}
                <h3 class="text-lg font-semibold">{feature.title}</h3>
                {feature.description && (
                  <p class="mt-2 text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
