import { NextRequest, NextResponse } from "next/server"
import { commerceProviderReadsAllowed } from "@/lib/commerce/releaseGate"
import { searchPreviewDomains, type PreviewDomainSearchMode } from "@/lib/domains/previewDomainSearch"
import { logPreviewCheckoutTiming, startPreviewCheckoutTimer } from "@/lib/preview/domainCheckoutTiming"
import { requirePreviewDomainSearchContext } from "../previewCheckoutContext"
import { browserOriginMatchesAuthority, isPreviewRequestAuthority } from "@/lib/requestAuthority"
import { runBudgetedSearch, CostlySearchBudgetError } from "@/lib/builder/costlySearchBudget"
import { readBoundedJSON, BodyReadError } from "@/lib/http/body"

export type PreviewDomainSearchErrorCode =
  | "request_authority_rejected"
  | "preview_context_unavailable"
  | "provider_reads_disabled"
  | "domain_search_failed"
  | "search_technical_limit"
  | "invalid_search_request"

export async function POST(request: NextRequest, route: { params: Promise<{ clientSlug: string }> }) {
  const startedAt = startPreviewCheckoutTimer()
  const { clientSlug } = await route.params
  let mode: PreviewDomainSearchMode = "primary"
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
  let body: unknown
  try { body = await readBoundedJSON(request, 2048, 5000) }
  catch (error) { return NextResponse.json({ ok: false, errorCode: "invalid_search_request" }, { status: error instanceof BodyReadError && error.code === "payload_too_large" ? 413 : 400 }) }
  const source = body && typeof body === "object" && !Array.isArray(body) ? body as { query?: unknown; mode?: unknown } : {}
  if (typeof source.query !== "string" || source.query.length > 120 || source.mode !== undefined && source.mode !== "more" && source.mode !== "primary") return NextResponse.json({ ok: false, errorCode: "invalid_search_request" }, { status: 400 })
  const query = source.query
  mode = source.mode === "more" ? "more" : "primary"
  try {
    const discovery = await runBudgetedSearch(context.payload, context.customerEmail, () => searchPreviewDomains({ run: context.run, query, mode, signal: request.signal }))
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
    if (error instanceof CostlySearchBudgetError) {
      return NextResponse.json({ ok: false, errorCode: "search_technical_limit", results: [], hasMore: false }, { status: 429 })
    }
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
