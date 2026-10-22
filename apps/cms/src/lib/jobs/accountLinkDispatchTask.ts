import { sql } from "@payloadcms/db-postgres"
import type { Payload, TaskConfig } from "payload"
import type { User } from "@/payload-types"
import { accountLinkMembershipMatches } from "@/lib/auth/accountLinkMembership"
import { asRecord } from "@/lib/record"
import { asMailLogPayload, sendEmail } from "@/lib/email/sendEmail"
import { accountLinkDeliveryFailure } from "@/lib/auth/accountLinkDelivery"
import { resetPasswordTemplate } from "@/lib/email/templates/resetPassword"
import { buildSuperAdminResetUrl } from "@/lib/auth/passwordRecovery"
import { assertPayloadCustomerActive } from "@/lib/auth/payloadCustomerAccess"
import { accountLinkFingerprint, claimQueuedAccountLink, beginAccountLinkDelivery, finishAccountLinkDelivery,
  cancelAccountLink } from "@/lib/auth/accountLinkStore"

export async function processAccountLinkDispatches(payload: Payload): Promise<number> {
  // A dead worker cannot establish non-delivery. Preserve its live token and
  // hold uncertain sends for the full expiry instead of re-queuing them.
  await payload.db.drizzle.execute(sql`UPDATE account_link_dispatches
    SET state='indeterminate', retry_state='manual_review', lease_token_hash=NULL, lease_until=NULL,
      outcome_code='E_PROVIDER_WRITE_INDETERMINATE', updated_at=clock_timestamp()
    WHERE state='dispatching' AND lease_until<=clock_timestamp()`)
  // A claimed queue item whose worker died before dispatch is definitely unsent.
  await payload.db.drizzle.execute(sql`UPDATE account_link_dispatches SET state='queued', lease_token_hash=NULL, lease_until=NULL
    WHERE namespace='payload' AND state='issuing' AND lease_until<=clock_timestamp() AND expires_at>clock_timestamp()`)
  const queued = await payload.find({ collection: "account-link-dispatches", overrideAccess: true, depth: 0,
    where: { and: [{ namespace: { equals: "payload" } }, { state: { equals: "queued" } },
      { expiresAt: { greater_than: new Date().toISOString() } }] }, limit: 50, sort: "createdAt" })
  let processed = 0
  for (const receipt of queued.docs) {
    const lease = await claimQueuedAccountLink(payload, receipt.id)
    if (!lease) continue
    let user: User | null
    try {
      user = await payload.db.findOne<User>({ collection: "users", where: { id: { equals: receipt.payloadUserId } } })
      if (!user || !accountLinkMembershipMatches(receipt, user) || !user.resetPasswordToken ||
        accountLinkFingerprint("payload", user.resetPasswordToken) !== receipt.tokenFingerprint ||
        Date.parse(user.resetPasswordExpiration ?? "") <= Date.now()) throw new Error("Target changed")
      await assertPayloadCustomerActive(payload, user.id)
    } catch {
      await cancelAccountLink(payload, lease)
      continue
    }
    await beginAccountLinkDelivery(payload, lease)
    try {
      const message = resetPasswordTemplate({ resetUrl: buildSuperAdminResetUrl(user.resetPasswordToken!),
        locale: asRecord(receipt.metadata)?.locale === "en" ? "en" : "nl" })
      await sendEmail({ to: receipt.recipient, ...message, intent: "auth.password_reset", payload: asMailLogPayload(payload) })
      await finishAccountLinkDelivery(payload, lease, { state: "sent" })
    } catch (error) {
      await finishAccountLinkDelivery(payload, lease, accountLinkDeliveryFailure(error))
    }
    processed++
  }
  // Bounded batches, never retire a still-valid token or a live lease. SDK and
  // Payload own token expiry/consumption; these rows contain only fingerprints.
  await payload.db.drizzle.execute(sql`DELETE FROM account_link_dispatches WHERE id IN (
    SELECT id FROM account_link_dispatches WHERE retention_after<clock_timestamp()
      AND (expires_at IS NULL OR expires_at<clock_timestamp()) AND (lease_until IS NULL OR lease_until<clock_timestamp()) LIMIT 200)`)
  await payload.db.drizzle.execute(sql`DELETE FROM account_link_windows WHERE id IN (
    SELECT id FROM account_link_windows WHERE expires_at<clock_timestamp()-interval '1 day' LIMIT 200)`)
  return processed
}

export const accountLinkDispatchTask: TaskConfig<{ input: Record<string, never>; output: { processed: number } }> = {
  slug: "account-link-dispatch",
  schedule: [{ cron: "0 * * * * *", queue: "default" }],
  concurrency: { key: () => "account-link-dispatch", exclusive: true, supersedes: true },
  retries: { attempts: 1 }, inputSchema: [], outputSchema: [{ name: "processed", type: "number" }],
  handler: async ({ req }) => ({ output: { processed: await processAccountLinkDispatches(req.payload) } }),
}
