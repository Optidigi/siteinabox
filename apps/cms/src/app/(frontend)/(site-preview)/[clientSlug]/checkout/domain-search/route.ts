import { NextRequest, NextResponse } from "next/server"
import { commerceProviderReadsAllowed } from "@/lib/commerce/releaseGate"
import { searchPreviewDomains, type PreviewDomainSearchMode } from "@/lib/domains/previewDomainSearch"
import { logPreviewCheckoutTiming, startPreviewCheckoutTimer } from "@/lib/preview/domainCheckoutTiming"
import { requirePreviewDomainSearchContext } from "../previewCheckoutContext"
import { browserOriginMatchesAuthority, isPreviewRequestAuthority } from "@/lib/requestAuthority"

export async function POST(request: NextRequest, route: { params: Promise<{ clientSlug: string }> }) {
  const startedAt = startPreviewCheckoutTimer()
  const { clientSlug } = await route.params
  if (!isPreviewRequestAuthority(request.headers) || !browserOriginMatchesAuthority(request.headers, { originRequired: true })) {
    return NextResponse.json({ ok: false }, { status: 403 })
  }
  const body: unknown = await request.json().catch(() => null)
  const source = body && typeof body === "object" ? body as { query?: unknown; mode?: unknown } : {}
  const query = typeof source.query === "string" ? source.query : ""
  const mode: PreviewDomainSearchMode = source.mode === "more" ? "more" : "primary"
  const context = await requirePreviewDomainSearchContext(clientSlug, request.headers).catch(() => null)
  if (!context) return NextResponse.json({ ok: false }, { status: 401 })
  if (!commerceProviderReadsAllowed()) return NextResponse.json({ ok: false, results: [], hasMore: false }, { status: 503 })
  try {
    const discovery = await searchPreviewDomains({ run: context.run, query, mode, signal: request.signal })
    logPreviewCheckoutTiming("domain_search_total", startedAt, { clientSlug: context.clientSlug }, {
      mode, candidateCount: discovery.results.length, ok: true,
    })
    return NextResponse.json({ ok: true, ...discovery }, {
      headers: {
        "Cache-Control": "no-store",
        "Server-Timing": `domain-search;dur=${Math.max(0, Math.round(performance.now() - startedAt))}`,
      },
    })
  } catch {
    logPreviewCheckoutTiming("domain_search_total", startedAt, { clientSlug: context.clientSlug }, { mode, ok: false })
    return NextResponse.json({ ok: false, results: [], hasMore: false }, { status: 502 })
  }
}
