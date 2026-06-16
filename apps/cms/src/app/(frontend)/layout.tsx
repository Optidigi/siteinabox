// CSP nonce flow (OBS-1/OBS-18): middleware generates a per-request nonce,
// stamps it on both the response CSP header (`script-src 'nonce-<N>'`) and the
// forwarded request header (`x-csp-nonce`). Next.js 15 reads `x-csp-nonce`
// from the request headers automatically and applies the nonce to all
// framework-emitted inline scripts (hydration, chunk loader, etc.).
//
// There are currently no user-authored <Script> components in these layouts, so
// no explicit `headers().get("x-csp-nonce")` read is needed here. If an inline
// <Script> is ever added, follow this pattern:
//
//   import { headers } from "next/headers"
//   import Script from "next/script"
//   // In the async component body:
//   const nonce = (await headers()).get("x-csp-nonce") ?? undefined
//   <Script id="..." nonce={nonce}>...</Script>
import "@/styles/globals.css"
import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { cookies, headers } from "next/headers"
import { NextIntlClientProvider } from "next-intl"
import { CspNonceProvider } from "@siteinabox/ui/lib/csp-nonce"
import { ThemeProvider } from "@/components/theme-provider"
import { StatusFeedbackProvider } from "@/components/status-feedback"
import { defaultLocale, localeCookieName, localeFromAcceptLanguage, resolveLocale } from "@/i18n/config"
import { loadMessages } from "@/i18n/messages"

const sans = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans" })
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" })

// WCAG 2.4.2 (Page Titled, Level A) — every route gets a non-empty <title>.
// Pages without a `metadata.title` export inherit `default`. Pages with one
// get `template` applied — e.g. `title: "Sites"` renders "Sites · SiteInABox".
// Dynamic routes use `generateMetadata` to inject the tenant / page name (see
// /sites/[slug]/page.tsx and /sites/[slug]/pages/[id]/page.tsx).
export const metadata: Metadata = {
  title: { default: "SiteInABox", template: "%s · SiteInABox" },
  icons: { icon: "/logos/favicon.svg" },
}

export default async function FrontendLayout({ children }: { children: React.ReactNode }) {
  // next-themes injects an inline anti-flicker script; without a nonce it
  // is CSP-blocked under the v2 'nonce-<N>' policy, which breaks the page's
  // entire hydration chain (React event handlers never attach → login form
  // GET-submits creds in the URL bar).
  const headerStore = await headers()
  const cookieStore = await cookies()
  const nonce = headerStore.get("x-csp-nonce") ?? undefined
  const locale = resolveLocale(
    cookieStore.get(localeCookieName)?.value,
    localeFromAcceptLanguage(headerStore.get("accept-language")),
    defaultLocale,
  )
  const messages = await loadMessages(locale)
  return (
    <html lang={locale} suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <CspNonceProvider nonce={nonce}>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange nonce={nonce}>
              <StatusFeedbackProvider>
                {children}
              </StatusFeedbackProvider>
            </ThemeProvider>
          </CspNonceProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
