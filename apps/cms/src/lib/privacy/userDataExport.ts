import { sendEmail } from "@/lib/email/sendEmail"

const tenantIdOf = (value: unknown): number | string | null => {
  if (value == null) return null
  if (typeof value === "object") {
    const id = (value as { id?: unknown }).id
    return typeof id === "number" || typeof id === "string" ? id : null
  }
  return typeof value === "number" || typeof value === "string" ? value : null
}

const safeUser = (user: any) => ({
  id: user.id,
  email: user.email,
  name: user.name ?? null,
  role: user.role,
  language: user.language ?? null,
  editorMode: user.editorMode ?? null,
  createdAt: user.createdAt ?? null,
  updatedAt: user.updatedAt ?? null,
  tenants: ((user.tenants ?? []) as any[]).map((row) => ({
    tenant: tenantIdOf(row?.tenant),
  })),
})

export async function buildUserDataExport(payload: any, user: any) {
  const userId = user.id
  const freshUser = await payload.findByID({
    collection: "users",
    id: userId,
    depth: 1,
    overrideAccess: true,
  })
  const tenantIds = ((freshUser.tenants ?? []) as any[])
    .map((row) => tenantIdOf(row?.tenant))
    .filter((id): id is number | string => id != null)

  const tenantExports = []
  for (const tenantId of tenantIds) {
    const [tenant, settings, pages, media, forms] = await Promise.all([
      payload.findByID({ collection: "tenants", id: tenantId, depth: 0, overrideAccess: true }),
      payload.find({
        collection: "site-settings",
        where: { tenant: { equals: tenantId } },
        limit: 1,
        depth: 1,
        overrideAccess: true,
      }),
      payload.find({
        collection: "pages",
        where: { tenant: { equals: tenantId } },
        limit: 0,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: "media",
        where: { tenant: { equals: tenantId } },
        limit: 0,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: "forms",
        where: { tenant: { equals: tenantId } },
        limit: 0,
        depth: 0,
        overrideAccess: true,
      }),
    ])

    tenantExports.push({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        domain: tenant.domain,
        status: tenant.status,
      },
      siteSettings: settings.docs[0] ?? null,
      pages: pages.docs.map((page: any) => ({
        id: page.id,
        title: page.title,
        slug: page.slug,
        status: page.status,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      })),
      media: media.docs.map((item: any) => ({
        id: item.id,
        filename: item.filename,
        alt: item.alt ?? null,
        mimeType: item.mimeType ?? null,
        filesize: item.filesize ?? null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      forms: forms.docs.map((form: any) => ({
        id: form.id,
        title: form.title,
        retentionDays: form.retentionDays ?? null,
        createdAt: form.createdAt,
        updatedAt: form.updatedAt,
      })),
    })
  }

  return {
    generatedAt: new Date().toISOString(),
    user: safeUser(freshUser),
    sites: tenantExports,
  }
}

export async function emailUserDataExport(payload: any, user: any) {
  const data = await buildUserDataExport(payload, user)
  const json = JSON.stringify(data, null, 2)
  await sendEmail({
    to: data.user.email,
    subject: "Your SiteInABox data export",
    html: [
      "<p>Your requested SiteInABox data export is below.</p>",
      "<p>If you did not request this, contact support immediately.</p>",
      `<pre>${json
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")}</pre>`,
    ].join(""),
    intent: "privacy.data_export",
    payload,
  })
  return data
}
