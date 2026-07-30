import "server-only"

import type {
  CompleteZoneExport,
  MigrationSourceMechanism,
} from "@siteinabox/contracts/domain-migration"
import type {
  AutomaticSourceRefreshCredential,
} from "@/lib/domains/migrationSecrets"

export class MigrationSourceAuthorizationError extends Error {
  constructor(message = "The automatic DNS source authorization must be renewed.") {
    super(message)
    this.name = "MigrationSourceAuthorizationError"
  }
}

export class MigrationSourceRefreshRetryableError extends Error {
  constructor(message = "The automatic DNS source authorization refresh is temporarily unavailable.") {
    super(message)
    this.name = "MigrationSourceRefreshRetryableError"
  }
}

export type AutomaticMigrationSourceMechanism = Exclude<
  MigrationSourceMechanism,
  "customer_authorized_provider_export_v1"
>

export type AcquiredMigrationSource = {
  mechanism: AutomaticMigrationSourceMechanism
  zone: CompleteZoneExport
  refreshCredential: AutomaticSourceRefreshCredential
}

export type MigrationSourcePublicEvidence = {
  authoritativeNameservers: string[]
  dnssecDsPresent: boolean
  dnssecDsRecords?: string[]
  dnssecDsTtl?: number | null
}

export const sourceAuthorityMechanism = (
  mechanism: AutomaticMigrationSourceMechanism,
): CompleteZoneExport["authority"]["mechanism"] => {
  if (mechanism === "cloudflare_api_v1") return "cloudflare_api"
  if (mechanism === "authorized_axfr_v1") return "authorized_axfr"
  return "validated_provider_export"
}
