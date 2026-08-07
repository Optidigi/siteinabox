import { AuthShell } from "@/components/auth-shell"
import { PreviewLoginForm } from "@/components/preview/PreviewLoginForm"

export function PreviewLoginShell({
  clientSlug,
  callbackPath,
  title,
  description,
}: {
  clientSlug: string
  callbackPath: string
  title: string
  description: string
}) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-start bg-muted px-6 pt-[max(env(safe-area-inset-top),1.5rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)] md:justify-center md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <AuthShell
          media={
            <div className="absolute inset-0 flex items-center justify-center bg-primary p-8">
              <img src="/logos/logo-dark.svg" alt="SiteInABox" className="h-32 w-auto max-w-full dark:hidden" />
              <img src="/logos/logo-light.svg" alt="SiteInABox" className="hidden h-32 w-auto max-w-full dark:block" />
            </div>
          }
        >
          <div className="flex flex-col gap-6">
            <div className="grid gap-2 text-left">
              <h1 className="text-xl font-semibold tracking-normal text-foreground">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <PreviewLoginForm clientSlug={clientSlug} callbackPath={callbackPath} />
          </div>
        </AuthShell>
      </div>
    </main>
  )
}
