import { createLocalReq } from "payload"
import { beforeAll, describe, expect, it } from "vitest"

import { getTestPayload } from "./_helpers"
import {
  down as removeTransferConfirmationSchema,
  up as restoreTransferConfirmationSchema,
} from "@/migrations/20260727_154129_phase11_transfer_confirmation"

let payload: Awaited<ReturnType<typeof getTestPayload>>

beforeAll(async () => {
  payload = await getTestPayload()
}, 30_000)

const executeRaw = (raw: string) => payload.db.execute({
  drizzle: payload.db.drizzle,
  raw,
})

describe("Phase 11 generated migration rollback rehearsal", () => {
  it("requires transfer-out queue and log rows to be drained before down migration", async () => {
    await executeRaw(`
      WITH job AS (
        INSERT INTO payload_jobs (input, task_slug, queue)
        VALUES ('{"managedDomainId":"10"}', 'prepare-domain-transfer-out', 'default')
        RETURNING id
      )
      INSERT INTO payload_jobs_log (
        _order, _parent_id, id, executed_at, completed_at, task_slug,
        task_i_d, input, output, state
      )
      SELECT
        1, id, 'phase11-rollback-log', now(), now(),
        'prepare-domain-transfer-out', 'phase11-rollback-task',
        '{"managedDomainId":"10"}', '{"status":"prepared"}', 'succeeded'
      FROM job;
    `)
    const req = await createLocalReq({}, payload)
    await expect(removeTransferConfirmationSchema({
      db: payload.db.drizzle,
      payload,
      req,
    })).rejects.toThrow()

    await executeRaw(`
      DELETE FROM payload_jobs
      WHERE task_slug = 'prepare-domain-transfer-out';
    `)
    await expect(removeTransferConfirmationSchema({
      db: payload.db.drizzle,
      payload,
      req,
    })).resolves.toBeUndefined()
    await expect(restoreTransferConfirmationSchema({
      db: payload.db.drizzle,
      payload,
      req,
    })).resolves.toBeUndefined()
  })
})
