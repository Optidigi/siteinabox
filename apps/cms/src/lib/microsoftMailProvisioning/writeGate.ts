import { COMMERCE_RELEASE_EVIDENCE_VERSION } from "@siteinabox/contracts/commerce"

/** Live Microsoft/Pax8 has no sandbox endpoint. The global emergency stop also
 * stops mail, while registrar-specific prerequisites remain in domain commerce. */
export function requireLiveMailWritesAllowed(env: NodeJS.ProcessEnv = process.env): void {
  if (env.COMMERCE_RELEASE_STAGE !== "production" || env.COMMERCE_PROVIDER_WRITES_ACKNOWLEDGED !== "1" ||
    env.COMMERCE_RELEASE_EVIDENCE_VERSION !== COMMERCE_RELEASE_EVIDENCE_VERSION || env.COMMERCE_ORIGIN_ISOLATION_VERIFIED !== "1" ||
    env.NODE_ENV !== "production" || env.MICROSOFT_MAIL_LIVE_PROVISIONING_ENABLED !== "true") {
    throw new Error("Live email provisioning is blocked by the staged commerce release gate.")
  }
}
