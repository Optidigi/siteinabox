import type { Metadata } from "next"
import { renderBuilderWorkspace } from "@/lib/builder/loadBuilderWorkspace"

export const metadata: Metadata = {
  title: "Bouw je website",
}

export default async function BuilderClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientSlug: string }>
  searchParams: Promise<{ intent?: string }>
}) {
  const { clientSlug } = await params
  const query = await searchParams
  const intent = query.intent === "register" ? "register" : "login"
  return renderBuilderWorkspace({ intent, requiredClientSlug: clientSlug })
}
