import { createReadStream, promises as fs } from "node:fs"
import { resolve } from "node:path"
import { Readable } from "node:stream"
import { NextRequest, NextResponse } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { nodeErrorCode } from "@/lib/record"

const DATA_DIR = process.env.DATA_DIR ?? resolve(process.cwd(), ".data-out")

const CONTENT_TYPES: Record<string, string> = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  mp4: "video/mp4",
  pdf: "application/pdf",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
}

type AuthUser = {
  role?: string | null
  tenants?: Array<{ tenant?: number | string | { id?: number | string | null } | null }>
}

const contentTypeFor = (filename: string, mimeType?: string | null): string => {
  if (mimeType) return mimeType
  const ext = filename.split(".").pop()?.toLowerCase()
  return (ext && CONTENT_TYPES[ext]) ?? "application/octet-stream"
}

const userTenantIds = (user: AuthUser): Set<string> => {
  const ids = new Set<string>()
  for (const entry of user.tenants ?? []) {
    const tenant = entry.tenant
    if (tenant == null) continue
    if (typeof tenant === "object") {
      if (tenant.id != null) ids.add(String(tenant.id))
    } else {
      ids.add(String(tenant))
    }
  }
  return ids
}

export const GET = async (
  req: NextRequest,
  ctx: { params: Promise<{ tenantId: string; filename: string }> },
) => {
  const { tenantId, filename } = await ctx.params
  if (!tenantId || !filename || filename.includes("../") || filename.includes("..\\")) {
    return new NextResponse("invalid media path", { status: 400 })
  }

  const payload = await getPayload({ config })
  const auth = await payload.auth({ headers: req.headers }).catch(() => ({ user: null }))
  const user = auth.user as AuthUser | null
  if (!user) return new NextResponse("unauthorized", { status: 401 })
  if (user.role !== "super-admin" && !userTenantIds(user).has(String(tenantId))) {
    return new NextResponse("forbidden", { status: 403 })
  }

  const media = await payload.find({
    collection: "media",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { filename: { equals: filename } },
      ],
    },
  })
  const doc = media.docs[0] as { mimeType?: string | null } | undefined
  if (!doc) return new NextResponse("not found", { status: 404 })

  const mediaRoot = resolve(DATA_DIR, "tenants", tenantId, "media")
  const filePath = resolve(mediaRoot, filename)
  if (!filePath.startsWith(mediaRoot + "/")) {
    return new NextResponse("forbidden", { status: 403 })
  }

  let stats
  try {
    stats = await fs.stat(filePath)
  } catch (err: unknown) {
    if (nodeErrorCode(err) === "ENOENT") return new NextResponse("not found", { status: 404 })
    return new NextResponse("read error", { status: 500 })
  }

  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "private, max-age=0, must-revalidate",
    "Content-Length": String(stats.size),
    "Content-Type": contentTypeFor(filename, doc.mimeType),
    "X-Content-Type-Options": "nosniff",
  })
  if (headers.get("Content-Type") === "image/svg+xml") {
    headers.set("Content-Security-Policy", "script-src 'none'")
  }

  const body = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>
  return new NextResponse(body, { headers, status: 200 })
}
