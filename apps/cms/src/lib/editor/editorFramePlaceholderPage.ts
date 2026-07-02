import type { Page as ContractPage } from "@siteinabox/contracts"

/**
 * Minimal contract page for `/__editor-frame/pages/new`. The parent `PageForm`
 * owns the real draft and replaces this placeholder via `page.replace` once the
 * iframe reports `renderer.ready`.
 */
export function createEditorFrameNewPagePlaceholder(): ContractPage {
  return {
    id: "new",
    slug: "",
    title: "",
    status: "draft",
    blocks: [],
    seo: {},
    updatedAt: new Date(0).toISOString(),
  }
}
