import * as React from "react"
import { cn } from "@siteinabox/ui/lib/utils"

export function PreviewFrameLoading({
  label,
  progress = 0,
  className,
}: {
  label: string
  progress?: number
  className?: string
}) {
  const clampedProgress = Math.min(100, Math.max(0, progress))
  const logoClassName = "block h-28 w-auto max-w-[80vw] object-contain sm:h-36 md:h-40"

  return (
    <div
      className={cn(
        "siab-preview-frame-loading relative isolate flex min-h-[24rem] w-full items-center justify-center overflow-hidden bg-background",
        className,
      )}
      aria-busy="true"
      aria-live="polite"
    >
      <div
        className="relative z-10 flex items-center justify-center"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clampedProgress)}
      >
        <div className="relative inline-block max-w-[80vw] dark:hidden">
          <img
            src="/logos/logo-light.svg"
            alt="SiteInABox"
            className={`${logoClassName} siab-preview-frame-loading__logo-base`}
          />
          {/* lint:ui-composition:ignore — the dynamic width is the loading meter. */}
          <div className="siab-preview-frame-loading__logo-fill absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${clampedProgress}%` }} aria-hidden="true">
            <img
              src="/logos/logo-light.svg"
              alt=""
              className={`${logoClassName} max-w-none`}
            />
          </div>
        </div>
        <div className="relative hidden max-w-[80vw] dark:inline-block">
          <img
            src="/logos/logo-dark.svg"
            alt=""
            aria-hidden="true"
            className={`${logoClassName} siab-preview-frame-loading__logo-base`}
          />
          {/* lint:ui-composition:ignore — the dynamic width is the loading meter. */}
          <div className="siab-preview-frame-loading__logo-fill absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${clampedProgress}%` }} aria-hidden="true">
            <img
              src="/logos/logo-dark.svg"
              alt=""
              className={`${logoClassName} max-w-none`}
            />
          </div>
        </div>
      </div>
      <span className="sr-only" role="status">{label}</span>
    </div>
  )
}
