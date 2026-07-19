import type { CollectionAfterReadHook, CollectionBeforeOperationHook } from "payload"

const tenantIdOf = (tenant: unknown): string | undefined => {
  if (tenant == null) return undefined
  if (typeof tenant === "object" && "id" in tenant) {
    const id = (tenant as { id?: string | number | null }).id
    return id == null ? undefined : String(id)
  }
  return String(tenant)
}

const mediaUrl = (tenantId: string, filename: string) =>
  `/api/tenant-media/${encodeURIComponent(tenantId)}/${encodeURIComponent(filename)}`

export const rewriteTenantMediaUrl: CollectionAfterReadHook = ({ doc }) => {
  const tenantId = tenantIdOf(doc.tenant)
  const filename = typeof doc.filename === "string" ? doc.filename : undefined
  if (!tenantId || !filename) return doc

  const url = mediaUrl(tenantId, filename)
  return {
    ...doc,
    url,
    thumbnailURL:
      typeof doc.thumbnailURL === "string" && doc.thumbnailURL.includes(`/media/file/${encodeURIComponent(filename)}`)
        ? url
        : doc.thumbnailURL,
  }
}

export const forceTenantMediaUploadFilename: CollectionBeforeOperationHook = ({ args, operation }) => {
  if ((operation === "create" || operation === "update" || operation === "updateByID") && (args).req?.file) {
    return {
      ...(args),
      overwriteExistingFiles: true,
    }
  }

  return args
}
