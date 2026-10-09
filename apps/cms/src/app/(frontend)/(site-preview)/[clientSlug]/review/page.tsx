import { recordVerifiedPreviewActivity } from "@/lib/preview/authenticatedPreviewActivity"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { PreviewLoginShell } from "@/components/preview/PreviewLoginShell"
import { PreviewReview } from "@/components/preview/PreviewReview"
import { readVerifiedPreviewSession } from "@/lib/auth/verifiedPreviewSession"
import { isPreviewHost } from "@/lib/preview/previewHost"
import { loadPreviewGrantContext, normalizePreviewClientSlug } from "@/lib/preview/previewAccess"
import { submitPreviewReviewAction } from "./actions"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("preview")
  return { title: t("reviewMetadataTitle") }
}

export default async function PreviewReviewPage({
  params,
}: {
  params: Promise<{ clientSlug: string }>
}) {
  if (!(await isPreviewHost())) notFound()

  const { clientSlug } = await params
  const normalizedClientSlug = normalizePreviewClientSlug(clientSlug)
  if (!normalizedClientSlug) notFound()

  const t = await getTranslations("preview")
  const headerStore = await headers()
  const callbackPath = `/${normalizedClientSlug}/review`
  const session = await readVerifiedPreviewSession(headerStore)
  const customerEmail = session?.user?.email

  if (!customerEmail) {
    return (
      <PreviewLoginShell
        clientSlug={normalizedClientSlug}
        callbackPath={callbackPath}
        title={t("loginTitle")}
        description={t("loginDescription")}
      />
    )
  }

  try {
    const context = await loadPreviewGrantContext({
      clientSlug: normalizedClientSlug,
      email: customerEmail,
    })
    await recordVerifiedPreviewActivity(headerStore, context.clientSlug)

    return (
      <PreviewReview
        tenantName={String(context.tenant.name)}
        previewHref={`/${context.clientSlug}`}
        submitReviewAction={submitPreviewReviewAction.bind(null, context.clientSlug)}
      />
    )
  } catch {
    return (
      <PreviewLoginShell
        clientSlug={normalizedClientSlug}
        callbackPath={callbackPath}
        title={t("accessUnavailableTitle")}
        description={t("accessUnavailableDescription")}
      />
    )
  }
}
