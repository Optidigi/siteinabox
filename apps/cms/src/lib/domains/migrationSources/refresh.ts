import "server-only"

import { resolveSoa } from "node:dns/promises"
import {
  normalizeCompleteZone,
  type CompleteZoneExport,
} from "@siteinabox/contracts/domain-migration"
import {
  domainMigrationSourceAuthorityHash,
} from "@/lib/domains/migrationEvidence"
import {
  inspectExistingDomainPublicEvidence,
  type ExistingDomainPublicEvidence,
} from "@/lib/domains/migrationCheckout"
import type {
  AutomaticCheckoutMigrationInput,
} from "@/lib/domains/migrationSecrets"
import { acquireAuthorizedAxfr } from "./axfr"
import { acquireCloudflareSource } from "./cloudflare"
import type { AcquiredMigrationSource } from "./types"

export class MigrationSourceChangedError extends Error {
  constructor() {
    super("The complete DNS source changed after checkout.")
    this.name = "MigrationSourceChangedError"
  }
}

type RefreshDependencies = {
  acquireCloudflareSource?: typeof acquireCloudflareSource
  acquireAuthorizedAxfr?: typeof acquireAuthorizedAxfr
  inspectPublicEvidence?: typeof inspectExistingDomainPublicEvidence
  resolveSoaImpl?: typeof resolveSoa
}

const canonicalNames = (values: string[]): string[] =>
  [...new Set(values.map((value) =>
    value.trim().toLowerCase().replace(/\.$/, "")))].sort()

const sameNames = (left: string[], right: string[]): boolean =>
  canonicalNames(left).join("\n") === canonicalNames(right).join("\n")

const requireSameSource = (
  acquired: AcquiredMigrationSource,
  accepted: AutomaticCheckoutMigrationInput,
): CompleteZoneExport => {
  if (
    acquired.mechanism !== accepted.sourceMechanism ||
    domainMigrationSourceAuthorityHash(normalizeCompleteZone(acquired.zone)) !==
      accepted.sourceZoneHash
  ) {
    throw new MigrationSourceChangedError()
  }
  return acquired.zone
}

const verifyExportAuthority = async (
  input: AutomaticCheckoutMigrationInput,
  dependencies: RefreshDependencies,
): Promise<CompleteZoneExport> => {
  const credential = input.sourceRefreshCredential
  if (credential.kind !== "provider_export") {
    throw new Error("Provider-export refresh authority is invalid.")
  }
  const [publicEvidence, soa] = await Promise.all([
    (dependencies.inspectPublicEvidence ?? inspectExistingDomainPublicEvidence)(
      input.domain,
    ),
    (dependencies.resolveSoaImpl ?? resolveSoa)(input.domain),
  ])
  const source = normalizeCompleteZone(input.sourceZone)
  if (
    soa.serial !== credential.sourceSoaSerial ||
    !sameNames(
      publicEvidence.authoritativeNameservers,
      source.authoritativeNameservers,
    ) ||
    publicEvidence.dnssecDsPresent !== (source.dnssec.status === "signed") ||
    domainMigrationSourceAuthorityHash(source) !== input.sourceZoneHash
  ) {
    throw new MigrationSourceChangedError()
  }
  return input.sourceZone
}

export async function refreshAutomaticMigrationSource(
  input: AutomaticCheckoutMigrationInput,
  dependencies: RefreshDependencies = {},
): Promise<CompleteZoneExport> {
  if (input.sourceMechanism === "cloudflare_api_v1") {
    const credential = input.sourceRefreshCredential
    if (credential.kind !== "cloudflare_api_token") {
      throw new Error("Cloudflare source refresh authority is invalid.")
    }
    const acquired = await (
      dependencies.acquireCloudflareSource ?? acquireCloudflareSource
    )({
      domain: input.domain,
      token: credential.token,
    })
    if (
      acquired.refreshCredential.kind !== "cloudflare_api_token" ||
      acquired.refreshCredential.zoneId !== credential.zoneId
    ) {
      throw new MigrationSourceChangedError()
    }
    return requireSameSource(acquired, input)
  }
  if (input.sourceMechanism === "authorized_axfr_v1") {
    const credential = input.sourceRefreshCredential
    if (credential.kind !== "authorized_axfr") {
      throw new Error("AXFR source refresh authority is invalid.")
    }
    const publicEvidence: ExistingDomainPublicEvidence = await (
      dependencies.inspectPublicEvidence ?? inspectExistingDomainPublicEvidence
    )(input.domain)
    return requireSameSource(
      await (
        dependencies.acquireAuthorizedAxfr ?? acquireAuthorizedAxfr
      )({
        domain: input.domain,
        nameserver: credential.nameserver,
        tsigName: credential.tsigName,
        tsigSecret: credential.tsigSecret,
        publicEvidence,
      }),
      input,
    )
  }
  return verifyExportAuthority(input, dependencies)
}
