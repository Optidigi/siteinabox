import { createReadStream, promises as fs } from "node:fs"
import { dirname, resolve } from "node:path"
import { Readable } from "node:stream"
import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { nodeErrorCode } from "@/lib/record"

const DATA_DIR = process.env.DATA_DIR ?? resolve(process.cwd(), ".data-out")

const CONTENT_TYPES: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
}

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.SIAB_RENDERER_API_TOKEN
  if (!expected) return process.env.NODE_ENV !== "production"
  const header = req.headers.get("authorization") ?? ""
  return header === `Bearer ${expected}`
}

const hasUnsafeSegment = (segments: string[]): boolean =>
  segments.some((segment) =>
    segment === "" ||
    segment === "." ||
    segment === ".." ||
    segment.includes("\\") ||
    segment.includes("\0")
  )

const contentTypeFor = (filename: string, mimeType?: string | null): string => {
  if (mimeType) return mimeType
  const ext = filename.split(".").pop()?.toLowerCase()
  return (ext && CONTENT_TYPES[ext]) ?? "application/octet-stream"
}

async function mediaResponse(
  req: NextRequest,
  ctx: { params: Promise<{ tenantId: string; path: string[] }> },
  includeBody: boolean,
) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { tenantId, path } = await ctx.params
  if (!tenantId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(tenantId) || hasUnsafeSegment(path)) {
    return new NextResponse("invalid media path", { status: 400 })
  }

  const filename = path.at(-1)
  if (!filename) return new NextResponse("invalid media path", { status: 400 })

  const payload = await getPayload({ config })
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
  const filePath = resolve(mediaRoot, ...path)
  if (!filePath.startsWith(`${mediaRoot}/`)) {
    return new NextResponse("forbidden", { status: 403 })
  }

  let stats
  try {
    stats = await fs.stat(filePath)
  } catch (err: unknown) {
    if (nodeErrorCode(err) === "ENOENT") {
      const stagingPath = resolve(DATA_DIR, "_uploads-tmp", filename)
      try {
        await fs.mkdir(dirname(filePath), { recursive: true })
        await fs.copyFile(stagingPath, filePath)
        stats = await fs.stat(filePath)
      } catch (copyErr: unknown) {
        if (nodeErrorCode(copyErr) === "ENOENT") return new NextResponse("not found", { status: 404 })
        return new NextResponse("read error", { status: 500 })
      }
    } else {
      return new NextResponse("read error", { status: 500 })
    }
  }
  if (!stats.isFile()) return new NextResponse("not found", { status: 404 })

  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
    "Content-Length": String(stats.size),
    "Content-Type": contentTypeFor(filename, doc.mimeType),
    "X-Content-Type-Options": "nosniff",
  })
  if (headers.get("Content-Type") === "image/svg+xml") {
    headers.set("Content-Security-Policy", "script-src 'none'")
  }

  if (!includeBody) return new NextResponse(null, { headers, status: 200 })
  const body = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>
  return new NextResponse(body, { headers, status: 200 })
}

export const GET = (req: NextRequest, ctx: { params: Promise<{ tenantId: string; path: string[] }> }) =>
  mediaResponse(req, ctx, true)

export const HEAD = (req: NextRequest, ctx: { params: Promise<{ tenantId: string; path: string[] }> }) =>
  mediaResponse(req, ctx, false)
