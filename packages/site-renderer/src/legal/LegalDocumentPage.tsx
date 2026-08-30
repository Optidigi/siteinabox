import * as React from "react"
import type { TenantPrivacyDisclosure } from "@siteinabox/contracts"
import type { ThemeTokenSpec } from "@siteinabox/contracts/generation"
import { RichTextRenderer } from "../rich-text/RichTextRenderer"
import { ThemeCanvas } from "../theme"

export type LegalDocumentPageProps = {
  document: TenantPrivacyDisclosure
  theme?: ThemeTokenSpec | null
  className?: string
}

/** Settings-owned legal document renderer. It is intentionally not a Page or block renderer. */
export function LegalDocumentPage({ document, theme, className }: LegalDocumentPageProps) {
  const title = document.title?.trim() || "Privacy- en cookieverklaring"
  return (
    <div className={className ?? "site-renderer"} data-siab-site-renderer data-siab-legal-document>
      <ThemeCanvas
        theme={theme}
        className="rt-canvas min-h-screen w-full bg-background text-foreground"
        data-legal-document="privacy-disclosure"
      >
        <main className="mx-auto w-full max-w-[var(--site-content-max-width,1280px)] px-5 py-16 sm:px-8 lg:py-24">
          <article className="mx-auto max-w-3xl">
            <header className="mb-10 border-b border-border pb-8">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">{title}</h1>
              <p className="mt-4 text-sm text-muted-foreground">
                Versie {document.version} · geldig vanaf {document.effectiveAt.slice(0, 10)}
              </p>
            </header>
            <div className="rt-content">
              <RichTextRenderer value={document.body} />
            </div>
          </article>
        </main>
      </ThemeCanvas>
    </div>
  )
}
