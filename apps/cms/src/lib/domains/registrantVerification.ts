import type { ManagedDomain } from "@/payload-types"

type ProviderVerificationRecord = {
  verificationEmailStatus?: string | null
  verificationEmailDescription?: string | null
}

export type ProviderRegistrantVerificationStatus =
  | "not_required"
  | "pending"
  | "verified"
  | "overdue"
  | "suspended"
  | "failed"

type StoredRegistrantVerificationStatus =
  ManagedDomain["registrantVerificationStatus"]

const verificationStatus = (
  value: string | null | undefined,
  verifiedStatuses: readonly string[],
): ProviderRegistrantVerificationStatus => {
  const status = value?.trim().toLowerCase() ?? ""
  if (!status) return "pending"
  if (["not applicable", "not required", "n/a"].includes(status)) {
    return "not_required"
  }
  if (verifiedStatuses.includes(status)) return "verified"
  if (status.includes("suspend")) return "suspended"
  if (status.includes("overdue") || status.includes("expired")) return "overdue"
  if (status.includes("fail") || status.includes("reject")) return "failed"
  return "pending"
}

export function registrationRegistrantVerification(
  record: ProviderVerificationRecord | null,
  tld: string,
): {
  status: ProviderRegistrantVerificationStatus
  description: string
} {
  const providerStatus = record?.verificationEmailStatus
  const status = verificationStatus(providerStatus, [
    "verified",
    "valid",
    "completed",
  ])
  const description = record?.verificationEmailDescription?.trim() ||
    (
      providerStatus?.trim()
        ? `Provider reports no registrant verification requirement for .${tld}.`
        : `Provider registrant verification status is not available yet for .${tld}.`
    )
  return { status, description }
}

export function migrationRegistrantVerification(
  record: ProviderVerificationRecord,
): ProviderRegistrantVerificationStatus {
  return verificationStatus(record.verificationEmailStatus, [
    "verified",
    "completed",
    "approved",
  ])
}

export function storedRegistrantVerification(
  providerStatus: ProviderRegistrantVerificationStatus,
  currentStatus: StoredRegistrantVerificationStatus,
): {
  status: StoredRegistrantVerificationStatus
  recovered: boolean
  customerActionRequired: boolean
} {
  const recovered = providerStatus === "verified" &&
    ["pending", "overdue", "suspended", "failed"].includes(currentStatus)
  const status = recovered ? "recovered" : providerStatus
  return {
    status,
    recovered,
    customerActionRequired: [
      "pending",
      "overdue",
      "suspended",
      "failed",
    ].includes(status),
  }
}
