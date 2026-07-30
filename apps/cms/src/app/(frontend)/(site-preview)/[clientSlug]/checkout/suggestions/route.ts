import { getLocale } from "next-intl/server"
import { NextRequest, NextResponse } from "next/server"
import { maxDomainProviderPriceFromEnv } from "@/lib/domains/orderState"
import { suggestAvailablePreviewDomainBatch } from "@/lib/domains/previewDomainOrder"
import { commerceProviderReadsAllowed } from "@/lib/commerce/releaseGate"
import { logPreviewCheckoutTiming, startPreviewCheckoutTimer } from "@/lib/preview/domainCheckoutTiming"
import type { PreviewCheckoutSuggestionsState } from "../actions"
import { requirePreviewCheckoutContext } from "../previewCheckoutContext"

type SuggestionsRequest = {
  domain: string
  cursor: number
  existing: string[]
}

const MAX_SUGGESTIONS = 5
const ROUTE_BATCH_SIZE = 10
const SUGGESTIONS_DEADLINE_MS = 1100

const jsonState = (state: PreviewCheckoutSuggestionsState, init?: ResponseInit) =>
  NextResponse.json(state, init)

const formatMoney = (locale: string, amount: string | null | undefined, currency = "EUR"): string | null => {
  if (!amount) return null

  const numericAmount = Number(amount)
  if (!Number.isFinite(numericAmount)) return `${currency} ${amount}`

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(numericAmount)
}

const readExisting = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 10)
  }
  if (typeof value !== "string") return []
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10)
}

const readCursor = (value: unknown): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.floor(parsed))
}

const readQueryRequest = (request: NextRequest): SuggestionsRequest => {
  const params = request.nextUrl.searchParams
  const repeatedExisting = params.getAll("existing").flatMap(readExisting)
  const commaExisting = readExisting(params.get("existing"))
  return {
    domain: String(params.get("domain") ?? "").trim().toLowerCase(),
    cursor: readCursor(params.get("cursor")),
    existing: [...new Set([...repeatedExisting, ...commaExisting])].slice(0, 10),
  }
}

const readJsonRequest = async (request: NextRequest): Promise<SuggestionsRequest> => {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  return {
    domain: String(body?.domain ?? "").trim().toLowerCase(),
    cursor: readCursor(body?.cursor),
    existing: readExisting(body?.existing),
  }
}

async function handleSuggestionsRequest(
  request: NextRequest,
  params: Promise<{ clientSlug: string }>,
  input: SuggestionsRequest,
) {
  const totalStart = startPreviewCheckoutTimer()
  const { clientSlug } = await params
  const authStart = startPreviewCheckoutTimer()
  const context = await requirePreviewCheckoutContext(clientSlug, request.headers).catch(() => null)
  if (!context) {
    logPreviewCheckoutTiming("suggestions_auth", authStart, { clientSlug }, { ok: false })
    return jsonState({ ok: false, suggestions: [], cursor: 0, done: true }, { status: 401 })
  }
  logPreviewCheckoutTiming("suggestions_auth", authStart, { clientSlug: context.clientSlug })

  if (!input.domain) {
    logPreviewCheckoutTiming("suggestions_total", totalStart, { clientSlug: context.clientSlug }, { ok: false, reason: "missing_domain" })
    return jsonState({ ok: false, suggestions: [], cursor: 0, done: true })
  }
  if (!commerceProviderReadsAllowed()) {
    logPreviewCheckoutTiming("suggestions_total", totalStart, {
      clientSlug: context.clientSlug,
    }, { ok: false, reason: "provider_reads_disabled" })
    return jsonState({
      ok: false,
      domain: input.domain,
      suggestions: [],
      cursor: input.cursor,
      done: true,
    })
  }

  try {
    const locale = await getLocale()
    const includedProviderPrice = maxDomainProviderPriceFromEnv()
    const deadlineAt = performance.now() + SUGGESTIONS_DEADLINE_MS
    const existingDomains = new Set(input.existing)
    const rawSuggestions: Awaited<ReturnType<typeof suggestAvailablePreviewDomainBatch>>["suggestions"] = []
    let cursor = input.cursor
    let done = false

    while (rawSuggestions.length < MAX_SUGGESTIONS && !done && performance.now() <= deadlineAt) {
      const batchStart = startPreviewCheckoutTimer()
      const batch = await suggestAvailablePreviewDomainBatch(input.domain, includedProviderPrice, {
        cursor,
        batchSize: ROUTE_BATCH_SIZE,
        existingDomains: [...existingDomains],
      })
      logPreviewCheckoutTiming("suggestions_batch", batchStart, { clientSlug: context.clientSlug, domain: input.domain }, {
        count: batch.suggestions.length,
        cursor: batch.nextCursor,
        done: batch.done,
      })

      for (const suggestion of batch.suggestions) {
        if (existingDomains.has(suggestion.domain)) continue
        rawSuggestions.push(suggestion)
        existingDomains.add(suggestion.domain)
        if (rawSuggestions.length >= MAX_SUGGESTIONS) break
      }

      const previousCursor = cursor
      cursor = batch.nextCursor
      done = batch.done
      if (!done && cursor <= previousCursor) break
    }

    const suggestions = rawSuggestions.slice(0, MAX_SUGGESTIONS).map((suggestion) => {
      const extraFeeLabel = suggestion.extraFeeAmount && suggestion.extraFeeCurrency
        ? formatMoney(locale, suggestion.extraFeeAmount, suggestion.extraFeeCurrency)
        : null
      return { ...suggestion, extraFeeLabel }
    })
    logPreviewCheckoutTiming("suggestions_total", totalStart, { clientSlug: context.clientSlug, domain: input.domain }, {
      ok: true,
      count: suggestions.length,
    })
    return jsonState({
      ok: true,
      domain: input.domain,
      suggestions,
      cursor,
      done: done || suggestions.length >= MAX_SUGGESTIONS,
    })
  } catch (error) {
    console.error("Preview checkout suggestions route error", error instanceof Error ? error.message : "unknown")
    logPreviewCheckoutTiming("suggestions_total", totalStart, { clientSlug: context.clientSlug, domain: input.domain }, {
      ok: false,
    })
    return jsonState({
      ok: false,
      domain: input.domain,
      suggestions: [],
      cursor: input.cursor,
      done: true,
    }, { status: 200 })
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ clientSlug: string }> }) {
  return handleSuggestionsRequest(request, context.params, readQueryRequest(request))
}

export async function POST(request: NextRequest, context: { params: Promise<{ clientSlug: string }> }) {
  return handleSuggestionsRequest(request, context.params, await readJsonRequest(request))
}
