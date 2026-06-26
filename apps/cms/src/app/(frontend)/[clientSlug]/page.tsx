import type { Metadata } from "next"
import { renderPreviewRoute } from "@/lib/preview/renderPreviewRoute"

export const metadata: Metadata = {
  title: "Preview",
}

export default async function ClientPreviewPage({
  params,
}: {
  params: Promise<{ clientSlug: string }>
}) {
  const { clientSlug } = await params
  return renderPreviewRoute({ clientSlug })
}
