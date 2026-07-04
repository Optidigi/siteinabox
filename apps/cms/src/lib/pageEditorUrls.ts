export type PageEditorUrlPage = {
  id: number | string
  slug?: string | null
}

export function pageEditorHref(baseHref: string, page: PageEditorUrlPage) {
  const slug = page.slug?.trim()
  if (slug) return `${baseHref}/edit/${encodeURIComponent(slug)}`
  return `${baseHref}/${page.id}`
}
