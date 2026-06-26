import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks"
import type { Block, MediaRef } from "../../lib/types"
import Hero from "../cms/Hero"
import RichText from "../cms/RichText"
import CTA from "../cms/CTA"
import FeatureList from "../cms/FeatureList"
import Testimonials from "../cms/Testimonials"
import FAQ from "../cms/FAQ"
import ContactSection from "../cms/ContactSection"
import { BlockErrorBoundary } from "../cms/BlockErrorBoundary"

type DraftMessage = {
  type: "preview:draft"
  version: 1
  payload: { page: { blocks: Block[] } }
}

type FocusBlockMessage = {
  type: "preview:focus-block"
  version: 1
  index: number
  seq?: number
}

type Props = {
  allowedOrigin: string
  cmsOrigin: string
}

/**
 * Preview island. Server-rendered as null; on mount (client:load) registers
 * postMessage listener. On `preview:draft` from the admin origin, swaps in
 * the rendered block tree.
 *
 * Sends:
 *  - preview:ready  once after first hydration
 *  - preview:heartbeat  every 30s after ready
 *  - preview:error  on render exceptions (caught by BlockErrorBoundary)
 *  - preview:click-block  when user clicks a block (cross-pane sync)
 *
 * Receives:
 *  - preview:draft  block tree updates
 *  - preview:focus-block  scroll + outline a block by index (admin → iframe)
 */
export default function PreviewIsland({ allowedOrigin, cmsOrigin }: Props) {
  const [draft, setDraft] = useState<{ blocks: Block[] } | null>(null)
  const savedScrollRef = useRef<number | null>(null)
  const lastFocusSeqRef = useRef<number>(-1)
  const highlightTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== allowedOrigin) return
      const data = e.data as
        | Partial<DraftMessage>
        | Partial<FocusBlockMessage>
        | null
      if (!data || typeof data !== "object") return
      if (data.type === "preview:draft" && data.version === 1) {
        const page = (data as DraftMessage).payload?.page
        if (page && Array.isArray(page.blocks)) {
          // Capture scroll BEFORE setDraft so React's commit can restore it.
          savedScrollRef.current = window.scrollY
          setDraft({ blocks: page.blocks })
        }
      } else if (data.type === "preview:focus-block" && data.version === 1) {
        const m = data as FocusBlockMessage
        if (typeof m.seq === "number" && m.seq <= lastFocusSeqRef.current) return
        if (typeof m.seq === "number") lastFocusSeqRef.current = m.seq
        if (typeof m.index !== "number") return
        const el = document.querySelector(
          `[data-block-index="${m.index}"]`,
        ) as HTMLElement | null
        if (!el) return
        el.scrollIntoView({ behavior: "smooth", block: "nearest" })
        el.classList.add("preview-focused")
        if (highlightTimerRef.current != null) {
          clearTimeout(highlightTimerRef.current)
        }
        highlightTimerRef.current = window.setTimeout(() => {
          el.classList.remove("preview-focused")
          highlightTimerRef.current = null
        }, 1200)
      }
    }

    window.addEventListener("message", onMessage)

    // Send ready handshake to parent.
    if (window.parent !== window) {
      window.parent.postMessage({ type: "preview:ready", version: 1 }, allowedOrigin)
    }

    // Heartbeat every 30s.
    const heartbeat = window.setInterval(() => {
      if (window.parent !== window) {
        window.parent.postMessage(
          { type: "preview:heartbeat", version: 1, ts: Date.now() },
          allowedOrigin,
        )
      }
    }, 30000)

    return () => {
      window.removeEventListener("message", onMessage)
      clearInterval(heartbeat)
      if (highlightTimerRef.current != null) {
        clearTimeout(highlightTimerRef.current)
      }
    }
  }, [allowedOrigin])

  // Restore scroll position after each draft commit. useLayoutEffect runs
  // synchronously after DOM updates, so the user doesn't see a flash of
  // top-scrolled content before the restore.
  useLayoutEffect(() => {
    if (savedScrollRef.current != null) {
      window.scrollTo(0, savedScrollRef.current)
      savedScrollRef.current = null
    }
  }, [draft])

  if (!draft) return null

  return (
    <>
      <style>{`
        [data-block-index] { transition: outline-color 150ms ease-in-out; outline: 2px solid transparent; outline-offset: 2px; }
        [data-block-index].preview-focused { outline-color: rgb(59, 130, 246); }
      `}</style>
      <PreactBlocks
        blocks={draft.blocks}
        cmsOrigin={cmsOrigin}
        allowedOrigin={allowedOrigin}
      />
    </>
  )
}

// PreactBlocks: Preact-side mirror of Blocks.astro. Used only inside
// the preview island; production tenant pages use Blocks.astro directly.
function PreactBlocks({
  blocks,
  cmsOrigin,
  allowedOrigin,
}: {
  blocks: Block[]
  cmsOrigin: string
  allowedOrigin: string
}) {
  // Preview-mode resolver: prefer populated url (Payload depth>=1 returns
  // full Media objects); otherwise fall back to CMS-origin id-based path.
  const resolveMedia = (ref: MediaRef): string | null => {
    if (ref == null) return null
    if (typeof ref === "object" && "url" in ref && ref.url) {
      // Populated Media object — use its url. If url is relative (e.g.
      // "/api/media/file/hero.png"), prepend cmsOrigin.
      return ref.url.startsWith("http") ? ref.url : `${cmsOrigin}${ref.url}`
    }
    // Bare id — no extension info; admin sends populated objects in
    // production. Return null gracefully.
    return null
  }

  // Delegated click — bubble a "click-block" message up to the admin so it
  // can scroll/focus the matching editor row. Bail when the user clicked
  // an interactive child so anchors/buttons/inputs keep working.
  const onClick = (e: Event) => {
    const target = e.target as HTMLElement | null
    if (!target) return
    if (target.closest("a, button, input, textarea, select, label, summary, details")) return
    const blockEl = target.closest("[data-block-index]") as HTMLElement | null
    if (!blockEl) return
    const idx = parseInt(blockEl.getAttribute("data-block-index") ?? "", 10)
    if (Number.isNaN(idx)) return
    if (window.parent !== window) {
      window.parent.postMessage(
        { type: "preview:click-block", version: 1, index: idx },
        allowedOrigin,
      )
    }
  }

  return (
    <div onClick={onClick}>
      {blocks.map((block, i) => (
        <BlockErrorBoundary key={i} blockType={block.blockType}>
          <PreactBlock
            block={block}
            resolveMedia={resolveMedia}
            dataBlockIndex={i}
          />
        </BlockErrorBoundary>
      ))}
    </div>
  )
}

function PreactBlock({
  block,
  resolveMedia,
  dataBlockIndex,
}: {
  block: Block
  resolveMedia: (ref: MediaRef) => string | null
  dataBlockIndex: number
}) {
  if (block.blockType === "hero") {
    return (
      <Hero
        eyebrow={block.eyebrow}
        headline={block.headline}
        subheadline={block.subheadline}
        cta={block.cta}
        imageUrl={resolveMedia(block.image as MediaRef)}
        dataBlockIndex={dataBlockIndex}
      />
    )
  }
  if (block.blockType === "richText") {
    return <RichText body={block.body} dataBlockIndex={dataBlockIndex} />
  }
  if (block.blockType === "cta") {
    return (
      <CTA
        headline={block.headline}
        description={block.description}
        primary={block.primary}
        secondary={block.secondary}
        dataBlockIndex={dataBlockIndex}
      />
    )
  }
  if (block.blockType === "featureList") {
    return (
      <FeatureList
        title={block.title}
        intro={block.intro}
        features={block.features}
        dataBlockIndex={dataBlockIndex}
      />
    )
  }
  if (block.blockType === "testimonials") {
    const items = block.items.map((it) => ({
      quote: it.quote,
      author: it.author,
      role: it.role,
      avatarUrl: resolveMedia(it.avatar as MediaRef),
    }))
    return (
      <Testimonials
        title={block.title}
        items={items}
        dataBlockIndex={dataBlockIndex}
      />
    )
  }
  if (block.blockType === "faq") {
    return (
      <FAQ title={block.title} items={block.items} dataBlockIndex={dataBlockIndex} />
    )
  }
  if (block.blockType === "contactSection") {
    return (
      <ContactSection
        title={block.title}
        description={block.description}
        formName={block.formName}
        fields={block.fields}
        dataBlockIndex={dataBlockIndex}
      />
    )
  }
  return null
}
