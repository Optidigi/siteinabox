"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { getPayload } from "payload"
import config from "@/payload.config"
import { promoteGenerationRunPages } from "@/lib/site-generation/promoteGenerationRunPages"

export async function promoteGenerationRunPagesAction(generationRunId: string | number): Promise<void> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user || user.role !== "super-admin") throw new Error("Forbidden: super-admin access required")

  await promoteGenerationRunPages(payload, generationRunId, { promotedBy: user.id })
  revalidatePath(`/generation-runs/${generationRunId}`)
}
