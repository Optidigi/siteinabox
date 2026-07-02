import * as React from "react"
import { createRoot } from "react-dom/client"
import type { Page } from "@siteinabox/contracts"
import type { PublishedSiteSnapshot } from "@siteinabox/contracts/generation"
import {
  IFRAME_EDITOR_PROTOCOL_NAME,
  IFRAME_EDITOR_PROTOCOL_VERSION,
  type IframeEditorErrorMessage,
  type IframeEditorMessage,
  validateIframeEditorMessage,
} from "@siteinabox/contracts/iframe-editor"
import { SitePageRenderer, createRendererMediaResolver } from "@siteinabox/site-renderer"
import { fixturePublishedSiteSnapshot } from "../fixtures/published-site"

type RendererFrameState = {
  snapshot: PublishedSiteSnapshot
  page: Page
}

type RendererErrorBoundaryState = {
  error: Error | null
}

declare global {
  interface Window {
    __SIAB_RENDERER_IFRAME_INITIAL__?: Partial<RendererFrameState>
  }
}

const rootElement = document.getElementById("siab-renderer-editor-root")
const parentOrigin = resolveParentOrigin()

function resolveParentOrigin(): string | null {
  if (!document.referrer) return null
  try {
    return new URL(document.referrer).origin
  } catch {
    return null
  }
}

function firstPublishedPage(snapshot: PublishedSiteSnapshot) {
  return snapshot.pages.find((page) => page.status === "published") ?? snapshot.pages[0]
}

function toRendererPage(page: PublishedSiteSnapshot["pages"][number] | Page): Page {
  return {
    ...page,
    updatedAt: page.updatedAt ?? new Date(0).toISOString(),
    blocks: page.blocks as Page["blocks"],
  }
}

function initialState(): RendererFrameState {
  const initial = window.__SIAB_RENDERER_IFRAME_INITIAL__
  const snapshot = initial?.snapshot ?? fixturePublishedSiteSnapshot
  const page = initial?.page ? toRendererPage(initial.page) : firstPublishedPage(snapshot)

  if (!page) {
    throw new Error("renderer iframe requires at least one page")
  }

  return { snapshot, page: toRendererPage(page) }
}

function postToParent(message: IframeEditorMessage) {
  if (window.parent === window || !parentOrigin) return
  window.parent.postMessage(message, parentOrigin)
}

function postReady(state: RendererFrameState, revision: number) {
  postToParent({
    protocol: IFRAME_EDITOR_PROTOCOL_NAME,
    schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
    type: "renderer.ready",
    messageId: "renderer-ready",
    rendererId: "public-renderer-frame",
    revision,
    pageId: String(state.page.id ?? state.page.slug),
    capabilities: {
      selection: false,
      fieldEditing: false,
      assetPicking: false,
      viewportResize: false,
    },
  })
}

function postError(code: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const payload: IframeEditorErrorMessage = {
    protocol: IFRAME_EDITOR_PROTOCOL_NAME,
    schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
    type: "error",
    messageId: `error-${code}`,
    code,
    message,
    source: "renderer",
    recoverable: true,
  }
  postToParent(payload)
}

function replaceBlock(page: Page, blockId: string, patch: Record<string, unknown>): Page {
  return {
    ...page,
    blocks: page.blocks.map((block) => {
      const candidateId = (block as { id?: unknown }).id
      return candidateId === blockId ? ({ ...block, ...patch } as Page["blocks"][number]) : block
    }),
  }
}

function reorderBlocks(page: Page, blockIds: string[]): Page {
  const blocksById = new Map(page.blocks.map((block) => [String((block as { id?: unknown }).id), block]))
  const reordered = blockIds.map((id) => blocksById.get(id)).filter((block): block is Page["blocks"][number] => Boolean(block))
  return reordered.length === page.blocks.length ? { ...page, blocks: reordered } : page
}

class RendererErrorBoundary extends React.Component<
  { children: React.ReactNode },
  RendererErrorBoundaryState
> {
  state: RendererErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    postError("render_failed", error)
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="p-4 font-mono text-red-800">
          renderer error: {this.state.error.message}
        </div>
      )
    }

    return this.props.children
  }
}

function RendererEditorApp() {
  const [state, setState] = React.useState<RendererFrameState>(() => initialState())
  const revisionRef = React.useRef(0)

  React.useEffect(() => {
    postReady(state, revisionRef.current)
  }, [state])

  React.useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      if (parentOrigin && event.origin !== parentOrigin) return
      if (event.source !== window.parent) return

      const parsed = validateIframeEditorMessage(event.data, { currentRevision: revisionRef.current })
      if (!parsed.ok) return

      setState((current) => {
        try {
          const message = parsed.message
          if (!("expectedRevision" in message)) return current

          if (message.type === "page.replace") {
            revisionRef.current += 1
            return {
              snapshot: {
                ...current.snapshot,
                settings: message.settings ?? current.snapshot.settings,
                theme: message.theme !== undefined ? message.theme : current.snapshot.theme,
              },
              page: toRendererPage(message.page),
            }
          }

          if (message.type === "theme.patch") {
            revisionRef.current += 1
            return { ...current, snapshot: { ...current.snapshot, theme: message.theme } }
          }

          if (message.type === "block.patch") {
            revisionRef.current += 1
            return { ...current, page: replaceBlock(current.page, message.blockId, message.patch) }
          }

          if (message.type === "blocks.reorder") {
            revisionRef.current += 1
            return { ...current, page: reorderBlocks(current.page, message.blockIds) }
          }

          if (message.type === "blocks.insert") {
            revisionRef.current += 1
            const nextBlocks = [...current.page.blocks]
            const index = message.index ?? nextBlocks.length
            nextBlocks.splice(Math.min(index, nextBlocks.length), 0, message.block)
            return { ...current, page: { ...current.page, blocks: nextBlocks } }
          }

          if (message.type === "blocks.delete") {
            revisionRef.current += 1
            return {
              ...current,
              page: {
                ...current.page,
                blocks: current.page.blocks.filter((block) => String((block as { id?: unknown }).id) !== message.blockId),
              },
            }
          }

          return current
        } catch (error) {
          postError("message_rejected", error)
          return current
        }
      })
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  const mediaResolver = React.useMemo(
    () => createRendererMediaResolver(state.snapshot.tenantId),
    [state.snapshot.tenantId],
  )

  return (
    <RendererErrorBoundary>
      <SitePageRenderer
        page={state.page}
        settings={state.snapshot.settings}
        theme={state.snapshot.theme}
        tenantSlug={state.snapshot.tenantSlug}
        domain={state.snapshot.domain}
        mediaResolver={mediaResolver}
        includeBehaviorScripts={false}
      />
    </RendererErrorBoundary>
  )
}

if (!rootElement) {
  postError("mount_missing", "renderer iframe mount point was not found")
} else {
  createRoot(rootElement).render(<RendererEditorApp />)
}
