import type { Page, SiteSettings, ThemeTokenSpec } from "@siteinabox/contracts"

export type BuilderPreviewSnapshot = {
  pageId: string
  page: Page
  settings: SiteSettings
  theme: ThemeTokenSpec | null
}

export async function loadBuilderPreviewSnapshot(input: {
  clientSlug: string
  customerEmail: string
}): Promise<BuilderPreviewSnapshot | null> {
  try {
    const { getPreviewCustomizerDataForGrant } = await import("@/lib/preview/customizer")
    const data = await getPreviewCustomizerDataForGrant({
      clientSlug: input.clientSlug,
      customerEmail: input.customerEmail,
    })
    return {
      pageId: String(data.currentPage.id ?? data.currentPage.slug ?? "index"),
      page: data.currentPage,
      settings: data.settings,
      theme: data.rendererTheme,
    }
  } catch {
    return null
  }
}

export async function withBuilderPreview<T extends { ok: boolean; clientSlug?: string }>(
  result: T,
  contactEmail: string,
  applied: boolean,
): Promise<T & { applied?: boolean; previewSnapshot?: BuilderPreviewSnapshot | null }> {
  if (!result.ok || !applied || !result.clientSlug) {
    return { ...result, applied }
  }
  const previewSnapshot = await loadBuilderPreviewSnapshot({
    clientSlug: result.clientSlug,
    customerEmail: contactEmail,
  })
  return { ...result, applied, previewSnapshot }
}
