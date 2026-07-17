import "@/styles/generated-site-renderer.css"
import { headers } from "next/headers"
import { CspNonceProvider } from "@siteinabox/ui/lib/csp-nonce"

export default async function EditorFrameRootLayout({ children }: { children: React.ReactNode }) {
  const headerStore = await headers()
  const nonce = headerStore.get("x-csp-nonce") ?? undefined

  return (
    <html lang="nl" suppressHydrationWarning>
      <body>
        <CspNonceProvider nonce={nonce}>{children}</CspNonceProvider>
      </body>
    </html>
  )
}
