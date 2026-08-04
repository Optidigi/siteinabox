import { NextRequest, NextResponse } from "next/server"
import { commerceProviderReadsAllowed } from "@/lib/commerce/releaseGate"
import { searchPreviewDomains, type PreviewDomainSearchMode } from "@/lib/domains/previewDomainSearch"
import { logPreviewCheckoutTiming, startPreviewCheckoutTimer } from "@/lib/preview/domainCheckoutTiming"
import { requirePreviewDomainSearchContext } from "../previewCheckoutContext"
import { browserOriginMatchesAuthority, isPreviewRequestAuthority } from "@/lib/requestAuthority"

export type PreviewDomainSearchErrorCode =
  | "request_authority_rejected"
  | "preview_context_unavailable"
  | "provider_reads_disabled"
  | "domain_search_failed"

export async function POST(request: NextRequest, route: { params: Promise<{ clientSlug: string }> }) {
  const startedAt = startPreviewCheckoutTimer()
  const { clientSlug } = await route.params
  const body: unknown = await request.json().catch(() => null)
  const source = body && typeof body === "object" ? body as { query?: unknown; mode?: unknown } : {}
  const query = typeof source.query === "string" ? source.query : ""
  const mode: PreviewDomainSearchMode = source.mode === "more" ? "more" : "primary"
  const logFailure = (
    failureCode: PreviewDomainSearchErrorCode,
    errorName?: string,
  ) => {
    logPreviewCheckoutTiming("domain_search_total", startedAt, { clientSlug }, {
      mode,
      ok: false,
      failureCode,
      ...(errorName ? { errorName } : {}),
    })
  }
  if (!isPreviewRequestAuthority(request.headers) || !browserOriginMatchesAuthority(request.headers, { originRequired: true })) {
    logFailure("request_authority_rejected")
    return NextResponse.json({ ok: false, errorCode: "request_authority_rejected" as const }, { status: 403 })
  }
  const context = await requirePreviewDomainSearchContext(clientSlug, request.headers).catch(() => null)
  if (!context) {
    logFailure("preview_context_unavailable")
    return NextResponse.json({ ok: false, errorCode: "preview_context_unavailable" }, { status: 401 })
  }
  if (!commerceProviderReadsAllowed()) {
    logFailure("provider_reads_disabled")
    return NextResponse.json({
      ok: false,
      errorCode: "provider_reads_disabled",
      results: [],
      hasMore: false,
    }, { status: 503 })
  }
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
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "Error"
    logFailure("domain_search_failed", errorName)
    return NextResponse.json({
      ok: false,
      errorCode: "domain_search_failed",
      results: [],
      hasMore: false,
    }, { status: 502 })
  }
}
