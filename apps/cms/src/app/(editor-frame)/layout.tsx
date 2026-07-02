import "@/styles/generated-site-renderer.css"
import "@/styles/site-renderer-canvas.css"
import "@/styles/shadcn.css"
import { cookies, headers } from "next/headers"
import { NextIntlClientProvider } from "next-intl"
import { CspNonceProvider } from "@siteinabox/ui/lib/csp-nonce"
import { defaultLocale, localeCookieName, resolveLocale } from "@/i18n/config"
import { loadMessages } from "@/i18n/messages"
import { StatusFeedbackProvider } from "@/components/status-feedback"

export default async function EditorFrameRootLayout({ children }: { children: React.ReactNode }) {
  const headerStore = await headers()
  const cookieStore = await cookies()
  const nonce = headerStore.get("x-csp-nonce") ?? undefined
  const locale = resolveLocale(
    cookieStore.get(localeCookieName)?.value,
    defaultLocale,
  )
  const messages = await loadMessages(locale)

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <CspNonceProvider nonce={nonce}>
            <StatusFeedbackProvider>
              {children}
            </StatusFeedbackProvider>
          </CspNonceProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
