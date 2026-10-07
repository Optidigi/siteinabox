"use client"

import * as React from "react"
import { clientMediaListSchema, clientMeSchema, clientTenantListSchema, type ClientMedia } from "@/components/clientPayload"

export type MediaTenantId = number | string

type FetchLike = typeof fetch

type ResolveMediaTenantIdOptions = {
  fetcher?: FetchLike
  pathname?: string
}

export async function resolveMediaTenantId({
  fetcher = fetch,
  pathname = typeof window === "undefined" ? "" : window.location.pathname,
}: ResolveMediaTenantIdOptions = {}): Promise<MediaTenantId | null> {
  const meRes = await fetcher("/api/users/me")
  if (!meRes.ok) return null

  const meBody: unknown = await meRes.json()
  const meResult = clientMeSchema.safeParse(meBody)
  const me = meResult.success ? meResult.data.user : null
  if (!me) return null

  if (me.role === "super-admin") {
    const match = pathname.match(/\/sites\/([^/]+)/)
    if (!match?.[1]) return null

    const tenantRes = await fetcher(
      `/api/tenants?where[slug][equals]=${encodeURIComponent(match[1])}&limit=1`,
    )
    if (!tenantRes.ok) return null

    const tenantBody: unknown = await tenantRes.json()
    const tenantResult = clientTenantListSchema.safeParse(tenantBody)
    return tenantResult.success ? tenantResult.data.docs[0]?.id ?? null : null
  }

  const first = me.tenants?.[0]?.tenant
  return typeof first === "object" && first ? first.id : (first ?? null)
}

export async function fetchTenantMedia(
  tenantId: MediaTenantId,
  fetcher: FetchLike = fetch,
): Promise<ClientMedia[]> {
  const res = await fetcher(
    `/api/media?where[tenant][equals]=${encodeURIComponent(String(tenantId))}&limit=200&sort=-updatedAt`,
  )
  if (!res.ok) return []

  const body: unknown = await res.json()
  const parsed = clientMediaListSchema.safeParse(body)
  return parsed.success ? parsed.data.docs : []
}

export function useResolvedMediaTenantId(initialTenantId?: MediaTenantId | null) {
  const [resolvedTenantId, setResolvedTenantId] = React.useState<MediaTenantId | null>(
    initialTenantId ?? null,
  )

  React.useEffect(() => {
    if (resolvedTenantId != null) return

    let cancelled = false
    ;(async () => {
      const tenantId = await resolveMediaTenantId()
      if (tenantId != null && !cancelled) setResolvedTenantId(tenantId)
    })()

    return () => {
      cancelled = true
    }
  }, [resolvedTenantId])

  return resolvedTenantId
}
