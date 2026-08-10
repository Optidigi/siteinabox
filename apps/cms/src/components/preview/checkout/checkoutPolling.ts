import * as React from "react"

import type { CustomerMigrationStatus } from "@/lib/domains/migrationStatus"
import type { CustomerProvisioningStatus } from "@/lib/domains/provisioningStatus"
import type { PreviewCheckoutLiveStatus } from "@/lib/checkout/previewCheckoutContract"

import { checkoutStatusNeedsPolling } from "./checkoutLifecycle"

type CheckoutPollingInput = {
  loadLiveStatusAction?: () => Promise<PreviewCheckoutLiveStatus>
  paymentReturn: boolean
  paymentStatus: string
  migrationStatus: CustomerMigrationStatus | null
  provisioningStatus: CustomerProvisioningStatus | null
  transferCodeActionSucceeded: boolean
  transferCodeActionStatus: string
  applyLiveStatus: (next: PreviewCheckoutLiveStatus) => void
}

export const useCheckoutPolling = ({
  loadLiveStatusAction,
  paymentReturn,
  paymentStatus,
  migrationStatus,
  provisioningStatus,
  transferCodeActionSucceeded,
  transferCodeActionStatus,
  applyLiveStatus,
}: CheckoutPollingInput): void => {
  React.useEffect(() => {
    const customerActionJustSaved =
      transferCodeActionSucceeded && transferCodeActionStatus === "saved"
    if (
      !loadLiveStatusAction ||
      (
        !customerActionJustSaved &&
        !checkoutStatusNeedsPolling({
          paymentReturn: paymentReturn || customerActionJustSaved,
          paymentStatus,
          migrationStatus,
          provisioningStatus,
        })
      )
    ) {
      return
    }

    let stopped = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    const schedule = (delay: number) => {
      timeout = setTimeout(() => {
        void poll()
      }, delay)
    }
    const poll = async () => {
      if (stopped) return
      if (document.visibilityState === "hidden") {
        schedule(5_000)
        return
      }
      attempts += 1
      try {
        const next = await loadLiveStatusAction()
        if (stopped) return
        applyLiveStatus(next)
        if (
          attempts >= 30 ||
          !checkoutStatusNeedsPolling({
            paymentReturn: paymentReturn || customerActionJustSaved,
            paymentStatus: next.paymentStatus,
            migrationStatus: next.migrationStatus,
            provisioningStatus: next.provisioningStatus,
          })
        ) {
          return
        }
      } catch {
        if (stopped || attempts >= 30) return
      }
      schedule(Math.min(3_000 + attempts * 750, 15_000))
    }
    schedule(1_500)
    return () => {
      stopped = true
      if (timeout) clearTimeout(timeout)
    }
    // The bound server action is stable for this mounted checkout. Restarting
    // the loop on every status projection would create overlapping polls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loadLiveStatusAction,
    paymentReturn,
    transferCodeActionSucceeded,
    transferCodeActionStatus,
    applyLiveStatus,
  ])
}
