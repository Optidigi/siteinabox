import { Suspense } from "react"
import { headers } from "next/headers"
import { LoginForm } from "@/components/forms/LoginForm"
import { AuthShell } from "@/components/auth-shell"
import { getEnabledSocialAuthProvidersForHost } from "@/lib/socialAuth/providers"
import { isSuperAdminDomain, stripAdminPrefix } from "@/lib/hostToTenant"

/**
 * Adopts the local shadcn-style auth shell: two-column card with the form on
 * the left and a branded media panel on the right.
 * The auth shell stacks to a single column on phone widths.
 *
 * Departures from a generic two-column login block:
 *   - Social providers are shown only when configured — siab-payload remains
 *     invite-only and Payload-owned for authorization.
 *   - No "Don't have an account? Sign up" footer — invite-only.
 *   - Right panel uses the real SVG logo with dark/light CSS switching.
 */
export default async function LoginPage() {
  const headerStore = await headers()
  const host = headerStore.get("host") || ""
  const socialProviders = getEnabledSocialAuthProvidersForHost(host)
  const domain = stripAdminPrefix(host)
  const allowPasswordLogin = isSuperAdminDomain(domain, process.env.NEXT_PUBLIC_SUPER_ADMIN_DOMAIN)

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <div className="w-full max-w-sm md:max-w-4xl">
        <AuthShell
          media={
            <div className="absolute inset-0 flex items-center justify-center bg-primary p-8">
              <img src="/logos/logo-dark.svg"  alt="SiteInABox" className="h-32 w-auto max-w-full dark:hidden" />
              <img src="/logos/logo-light.svg" alt="SiteInABox" className="hidden dark:block h-32 w-auto max-w-full" />
            </div>
          }
        >
          <div className="flex flex-col gap-6">
            <Suspense>
              <LoginForm socialProviders={socialProviders} allowPasswordLogin={allowPasswordLogin} />
            </Suspense>
          </div>
        </AuthShell>
      </div>
    </main>
  )
}
