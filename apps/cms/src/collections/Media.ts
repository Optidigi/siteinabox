import type { CollectionConfig } from "payload"
import path from "path"
import { canRead, canWrite } from "@/access/roleHelpers"
import { projectMediaToDisk } from "@/hooks/projectToDisk"
import { deleteMediaFile } from "@/hooks/deleteFileFromDisk"
import { validateTenantExists } from "@/hooks/validateTenantExists"
import { ensureUniqueTenantFilename } from "@/hooks/ensureUniqueTenantFilename"
import { forceTenantMediaUploadFilename, rewriteTenantMediaUrl } from "@/hooks/mediaTenantUrls"

export const Media: CollectionConfig = {
  slug: "media",
  labels: { singular: { en: "Media item", nl: "Mediabestand" }, plural: { en: "Media", nl: "Media" } },
  access: { read: canRead, create: canWrite, update: canWrite, delete: canWrite },
  upload: {
    // Payload still needs a staticDir while generating upload metadata, but
    // projectMediaToDisk writes the request buffer into the tenant directory;
    // this scratch dir is not a canonical serving path.
    staticDir: path.resolve(process.cwd(), process.env.DATA_DIR || "./.data-out", "_uploads-tmp"),
    filenameCompoundIndex: ["tenant", "filename"],
    mimeTypes: ["image/*", "video/mp4", "application/pdf"]
  },
  admin: { useAsTitle: "filename", defaultColumns: ["filename", "alt", "mimeType", "filesize"] },
  fields: [
    { name: "alt", type: "text" },
    { name: "caption", type: "text" }
  ],
  hooks: {
    beforeOperation: [forceTenantMediaUploadFilename],
    beforeValidate: [validateTenantExists, ensureUniqueTenantFilename],
    afterRead: [rewriteTenantMediaUrl],
    afterChange: [projectMediaToDisk],
    afterDelete: [deleteMediaFile]
  }
}
