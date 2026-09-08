import { NextResponse, type NextRequest } from "next/server"
import { createLocalPreviewSessionCookie } from "@/lib/builder/localPreviewSession"
import { isLocalPreviewSessionBypass } from "@/lib/requestAuthority"

export async function GET(req: NextRequest) {
  if (!isLocalPreviewSessionBypass(req.headers)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 })
  }

  try {
    const cookie = await createLocalPreviewSessionCookie()
    // Relative Location keeps the browser on the public tunnel host. Next.js
    // request.url in development is the listen origin (localhost), which would
    // send a partner from trycloudflare.com onto their own machine.
    const response = new NextResponse(null, {
      status: 303,
      headers: { Location: "/builder" },
    })
    response.cookies.set(cookie)
    return response
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : "unknown"
    console.error("[local-preview-session]", detail)
    return NextResponse.json({ message: "Local preview session failed", detail }, { status: 500 })
  }
}
