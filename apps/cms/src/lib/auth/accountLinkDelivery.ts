import { MailPolicyBlockedError, MailSendError } from "@/lib/email/sendEmail"
import type { AccountLinkDeliveryOutcome } from "./accountLinkStore"

export function accountLinkDeliveryFailure(error: unknown): AccountLinkDeliveryOutcome {
  if (error instanceof MailPolicyBlockedError) return { state: "failed", code: "E_MAIL_POLICY_BLOCKED", retryable: false }
  if (error instanceof MailSendError && error.normalized.retryState !== "manual_review") {
    return { state: "failed", code: error.normalized.providerErrorCode ?? "E_MAIL_REJECTED",
      retryable: error.normalized.retryState === "retryable" }
  }
  return { state: "indeterminate", code: "E_PROVIDER_WRITE_INDETERMINATE" }
}
