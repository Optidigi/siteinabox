import { createLocalReq } from "payload"
import { beforeAll, describe, expect, it } from "vitest"

import {
  down as removeExistingDomainSafetySchema,
  up as restoreExistingDomainSafetySchema,
} from "@/migrations/20260728_130835_commerce_existing_domain_safety"
import { getTestPayload } from "./_helpers"

let payload: Awaited<ReturnType<typeof getTestPayload>>

beforeAll(async () => {
  payload = await getTestPayload()
}, 30_000)

const executeRaw = (raw: string) => payload.db.execute({
  drizzle: payload.db.drizzle,
  raw,
})

describe("existing-domain safety migration forward-recovery rehearsal", () => {
  it("retains migration checkout secret audit rows instead of rolling back", async () => {
    await executeRaw(`
      ALTER TABLE migration_checkout_secrets DISABLE TRIGGER ALL;
      INSERT INTO migration_checkout_secrets (
        secret_key,
        generation_run_id,
        domain_name_ascii,
        source_zone_hash,
        state,
        expires_at,
        consumed_at
      )
      VALUES (
        'integration-rollback-guard',
        2147000001,
        'rollback-guard.invalid',
        'integration-source-hash',
        'consumed',
        now(),
        now()
      );
      ALTER TABLE migration_checkout_secrets ENABLE TRIGGER ALL;
    `)
    const req = await createLocalReq({}, payload)

    await expect(removeExistingDomainSafetySchema({
      db: payload.db.drizzle,
      payload,
      req,
    })).rejects.toThrow(
      "migration checkout secret audit rows must be retained; use forward recovery",
    )

    await executeRaw(`
      DELETE FROM migration_checkout_secrets
      WHERE secret_key = 'integration-rollback-guard';
    `)
  })

  it("retains unresolved supplemental migration proposals instead of rolling back", async () => {
    await executeRaw(`
      ALTER TABLE domain_migrations DISABLE TRIGGER ALL;
      INSERT INTO domain_migrations (
        idempotency_key,
        originating_order_id,
        checkout_profile_id,
        tenant_id,
        domain_name_ascii,
        tld,
        accepted_classification,
        state,
        source_mechanism,
        operator_work_authorization_state,
        provider_transfer_state,
        cloudflare_zone_state,
        cutover_write_state,
        rollback_write_state,
        reconciliation_required,
        created_at,
        updated_at
      )
      VALUES (
        'integration-supplemental-rollback-guard',
        2147000002,
        2147000002,
        2147000002,
        'supplemental-rollback-guard.invalid',
        'invalid',
        'automatic',
        'assessment',
        'customer_authorized_provider_export_v1',
        'awaiting_customer_acceptance',
        'not_started',
        'not_started',
        'not_started',
        'not_started',
        false,
        now(),
        now()
      );
      ALTER TABLE domain_migrations ENABLE TRIGGER ALL;
    `)
    const req = await createLocalReq({}, payload)

    await expect(removeExistingDomainSafetySchema({
      db: payload.db.drizzle,
      payload,
      req,
    })).rejects.toThrow(
      "supplemental migration proposals must be resolved; use forward recovery",
    )

    await executeRaw(`
      DELETE FROM domain_migrations
      WHERE idempotency_key = 'integration-supplemental-rollback-guard';
    `)
  })

  it("rolls an empty schema down and restores it through the owning migration", async () => {
    const req = await createLocalReq({}, payload)

    await expect(removeExistingDomainSafetySchema({
      db: payload.db.drizzle,
      payload,
      req,
    })).resolves.toBeUndefined()
    await expect(restoreExistingDomainSafetySchema({
      db: payload.db.drizzle,
      payload,
      req,
    })).resolves.toBeUndefined()

    await expect(payload.find({
      collection: "migration-checkout-secrets",
      limit: 1,
      overrideAccess: true,
    })).resolves.toMatchObject({ totalDocs: 0 })
  })
})
