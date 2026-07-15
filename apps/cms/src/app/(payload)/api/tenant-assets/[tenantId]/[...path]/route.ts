import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "node:fs"
import { resolve, join } from "node:path"

/**
 * Serves the public editor asset allowlist from the disk projection:
 * `DATA_DIR/tenants/<tenantId>/cms-editor.css` and
 * `DATA_DIR/tenants/<tenantId>/files/*`. Used by the canvas to load font
 * files referenced by the compiled tenant CSS bundle.
 *
 * Read-only. Unknown tenant-root files are blocked before disk read; path
 * traversal is blocked both by segment validation and resolved containment.
 */
const dataDir = () => process.env.DATA_DIR ?? resolve(process.cwd(), ".data-out")

const CONTENT_TYPES: Record<string, string> = {
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  ico: "image/x-icon",
  css: "text/css",
}

const contentTypeFor = (path: string): string => {
  const ext = path.split(".").pop()?.toLowerCase()
  return (ext && CONTENT_TYPES[ext]) ?? "application/octet-stream"
}

const hasUnsafeSegment = (segments: string[]): boolean =>
  segments.some((segment) =>
    segment === "" ||
    segment === "." ||
    segment === ".." ||
    segment.includes("\\") ||
    segment.includes("\0")
  )

const isAllowedTenantAsset = (segments: string[]): boolean => {
  if (hasUnsafeSegment(segments)) return false
  if (segments.length === 1 && segments[0] === "cms-editor.css") return true
  return segments.length > 1 && segments[0] === "files"
}

export const GET = async (
  _req: NextRequest,
  ctx: { params: Promise<{ tenantId: string; path: string[] }> },
) => {
  const { tenantId, path } = await ctx.params
  if (!tenantId || !/^\d+$/.test(tenantId)) {
    return new NextResponse("invalid tenant id", { status: 400 })
  }
  if (hasUnsafeSegment(path)) {
    return new NextResponse("forbidden", { status: 403 })
  }
  if (!isAllowedTenantAsset(path)) {
    return new NextResponse("not found", { status: 404 })
  }
  const tenantRoot = resolve(dataDir(), "tenants", tenantId)
  const relPath = path.join("/")
  const fullPath = resolve(tenantRoot, relPath)
  // Path-traversal guard: resolved path must stay inside tenantRoot.
  if (!fullPath.startsWith(tenantRoot + "/") && fullPath !== tenantRoot) {
    return new NextResponse("forbidden", { status: 403 })
  }
  let buf: Buffer
  try {
    buf = await fs.readFile(fullPath)
  } catch (e: any) {
    if (e?.code === "ENOENT") return new NextResponse("not found", { status: 404 })
    return new NextResponse("read error", { status: 500 })
  }
  // Convert Node Buffer to Uint8Array for NextResponse body
  const body = new Uint8Array(buf)
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentTypeFor(relPath),
      "Cache-Control": "public, max-age=31536000, immutable",
      // Allow @font-face cross-origin loading from any preview iframe.
      "Access-Control-Allow-Origin": "*",
    },
  })
}
