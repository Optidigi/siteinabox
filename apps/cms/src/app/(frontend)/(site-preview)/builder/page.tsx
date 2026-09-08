import type { Metadata } from "next"
import { renderBuilderWorkspace } from "@/lib/builder/loadBuilderWorkspace"

export const metadata: Metadata = {
  title: "Bouw je website",
}

export default async function BuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>
}) {
  const params = await searchParams
  const intent = params.intent === "register" ? "register" : "login"
  return renderBuilderWorkspace({ intent })
}
