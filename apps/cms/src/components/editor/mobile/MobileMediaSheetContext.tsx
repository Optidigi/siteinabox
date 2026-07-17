"use client"
import * as React from "react"
import type { Media } from "@/payload-types"
import { MediaGrid } from "@/components/media/MediaGrid"
import { MediaUploader } from "@/components/media/MediaUploader"
import { fetchTenantMedia, resolveMediaTenantId } from "@/components/media/clientMedia"

/**
 * Host-provided context that backs the local mobile media sheet.
 * Owns ALL Payload-specific integration: tenant resolution, /api/users/me +
 * /api/tenants + /api/media fetches, the MediaGrid + MediaUploader composition.
 *
 * UI components never touch backend directly; they consume this context via
 * the useMobileMediaSheet() hook.
 *
 * Mirrors the BlockPresetsContext pattern from sub-phase 7.
 */

export type MediaItem = {
  id: number | string
  url?: string | null
  alt?: string | null
  width?: number | null
  height?: number | null
  filename?: string | null
}

export type MediaPickerProps = {
  items: MediaItem[]
  tenantId: number | string
  onPick: (item: MediaItem) => void
  onUploaded: (item: MediaItem) => void
}

export type MobileMediaSheetContextValue = {
  resolveTenantId: () => Promise<number | string | null>
  fetchMedia: (tenantId: number | string) => Promise<MediaItem[]>
  MediaPickerComponent: React.ComponentType<MediaPickerProps>
}

const MobileMediaSheetContext = React.createContext<MobileMediaSheetContextValue | null>(null)

function adaptMedia(m: Media): MediaItem {
  return {
    id: m.id,
    url: m.url ?? null,
    alt: m.alt ?? null,
    width: m.width ?? null,
    height: m.height ?? null,
    filename: m.filename ?? null,
  }
}

export function MobileMediaSheetProvider({ children }: { children: React.ReactNode }) {
  const resolveTenantId = React.useCallback(async (): Promise<number | string | null> => {
    return resolveMediaTenantId()
  }, [])

  const fetchMedia = React.useCallback(async (tenantId: number | string): Promise<MediaItem[]> => {
    return (await fetchTenantMedia(tenantId)).map(adaptMedia)
  }, [])

  const MediaPickerComponent = React.useMemo<React.ComponentType<MediaPickerProps>>(
    () =>
      function MediaPicker({ items, tenantId, onPick, onUploaded }) {
        return (
          <div className="space-y-4">
            <MediaUploader
              tenantId={tenantId}
              onUploaded={(m) => onUploaded(adaptMedia(m as Media))}
            />
            <MediaGrid
              items={items as unknown as Media[]}
              selectable
              onSelect={(m) => onPick(adaptMedia(m))}
            />
          </div>
        )
      },
    [],
  )

  const value: MobileMediaSheetContextValue = {
    resolveTenantId,
    fetchMedia,
    MediaPickerComponent,
  }

  return (
    <MobileMediaSheetContext.Provider value={value}>{children}</MobileMediaSheetContext.Provider>
  )
}

export function useMobileMediaSheet(): MobileMediaSheetContextValue {
  const ctx = React.useContext(MobileMediaSheetContext)
  if (!ctx) {
    throw new Error("useMobileMediaSheet must be used inside <MobileMediaSheetProvider>")
  }
  return ctx
}
