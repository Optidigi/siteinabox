import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { renderPreviewRoute } from "@/lib/preview/renderPreviewRoute"
import { isPreviewFixtureRoute } from "@/lib/preview/previewFixture"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clientSlug: string; pageSlug: string }>
}): Promise<Metadata> {
  const { clientSlug } = await params
  if (isPreviewFixtureRoute(clientSlug)) return { title: "Sitegen review" }
  const t = await getTranslations("preview")
  return { title: t("metadataTitle") }
}

export default async function ClientPreviewPage({
  params,
}: {
  params: Promise<{ clientSlug: string; pageSlug: string }>
}) {
  const { clientSlug, pageSlug } = await params
  return renderPreviewRoute({ clientSlug, pageSlug })
}
