"use server"

import { headers } from "next/headers"
import { getTranslations } from "next-intl/server"
import { previewAuth } from "@/lib/preview/betterAuth"
import { loadPreviewGrantContext, normalizePreviewClientSlug } from "@/lib/preview/previewAccess"
import type { PreviewReviewActionState } from "@/components/preview/PreviewReview"

const requirePreviewReviewContext = async (clientSlug: string) => {
  const t = await getTranslations("preview")
  const session = await previewAuth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  })
  const customerEmail = session?.user?.email
  if (!customerEmail) throw new Error(t("previewLoginRequired"))

  return loadPreviewGrantContext({
    clientSlug: normalizePreviewClientSlug(clientSlug),
    email: customerEmail,
  })
}

export async function submitPreviewReviewAction(
  clientSlug: string,
  _previousState: PreviewReviewActionState,
  formData: FormData,
): Promise<PreviewReviewActionState> {
  const t = await getTranslations("preview")
  const notes = String(formData.get("notes") ?? "").trim()
  if (!notes) return { ok: false, message: t("reviewNotesRequired") }

  try {
    const context = await requirePreviewReviewContext(clientSlug)
    const currentApproval = context.run.clientApproval && typeof context.run.clientApproval === "object"
      ? context.run.clientApproval as Record<string, unknown>
      : {}
    await context.payload.update({
      collection: "site-generation-runs",
      id: context.run.id,
      data: {
        clientApproval: {
          ...currentApproval,
          status: currentApproval.status === "approved" ? "approved" : "pending",
          reviewNotes: notes,
          reviewedAt: new Date().toISOString(),
          reviewedBy: context.customerEmail,
        },
      },
      depth: 0,
      overrideAccess: true,
    })
    return { ok: true, message: t("reviewSaved") }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : t("reviewSaveFailed"),
    }
  }
}
