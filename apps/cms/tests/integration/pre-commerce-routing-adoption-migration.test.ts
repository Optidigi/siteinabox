import { createLocalReq } from "payload"
import { beforeAll, describe, expect, it } from "vitest"

import {
  down as removeRoutingAdoptionSchema,
  up as applyRoutingAdoptionSchema,
} from "@/migrations/20260730_102220_durable_pre_commerce_routing_adoption"
import { getTestPayload } from "./_helpers"

let payload: Awaited<ReturnType<typeof getTestPayload>>

beforeAll(async () => {
  payload = await getTestPayload()
}, 30_000)

const executeRaw = (raw: string) => payload.db.execute({
  drizzle: payload.db.drizzle,
  raw,
})

const rowsFrom = <Row>(result: unknown): Row[] => {
  if (
    result &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray(result.rows)
  ) {
    return result.rows as Row[]
  }
  throw new Error("Expected a PostgreSQL result with rows.")
}

const migrationArgs = async () => ({
  db: payload.db.drizzle,
  payload,
  req: await createLocalReq({}, payload),
})

const seedHistoricalAmiCare = async () => {
  await executeRaw(`
    INSERT INTO tenants (
      id, name, slug, domain, status, domain_verification_status
    )
    OVERRIDING SYSTEM VALUE
    VALUES (
      2147000101, 'Historical routing fixture', 'historical-routing-fixture',
      'ami-care.nl', 'active', 'verified'
    );
    INSERT INTO published_site_snapshots (
      id, tenant_id, snapshot_key, version, status, domain, snapshot_hash,
      snapshot, published_at
    )
    OVERRIDING SYSTEM VALUE
    VALUES (
      2147000102, 2147000101, 'historical-routing-fixture:v1', 1, 'active',
      'ami-care.nl', 'historical-routing-hash', '{}'::jsonb, now()
    );
    UPDATE tenants
    SET active_snapshot_id = 2147000102
    WHERE id = 2147000101;
    INSERT INTO site_settings (
      id, tenant_id, site_name, site_url
    )
    OVERRIDING SYSTEM VALUE
    VALUES (
      2147000103, 2147000101, 'Historical routing fixture',
      'https://ami-care.nl'
    );
    INSERT INTO site_settings_aliases (
      _order, _parent_id, id, host
    )
    VALUES (
      1, 2147000103, 'historical-routing-www', 'www.ami-care.nl'
    );
  `)
}

const cleanHistoricalAmiCare = async () => {
  await executeRaw(`
    DELETE FROM managed_domains
    WHERE provisioning_idempotency_key = 'historical-routing-managed-domain';
    DELETE FROM site_settings_aliases
    WHERE id IN (
      'historical-routing-www',
      'historical-routing-conflicting-www'
    );
    DELETE FROM site_settings
    WHERE id IN (2147000103, 2147000113);
    UPDATE tenants
    SET active_snapshot_id = NULL
    WHERE id = 2147000101;
    DELETE FROM published_site_snapshots
    WHERE id = 2147000102;
    DELETE FROM tenants
    WHERE id IN (2147000101, 2147000111);
  `)
}

const seedConflictingWwwOwner = async () => {
  await executeRaw(`
    INSERT INTO tenants (
      id, name, slug, domain, status
    )
    OVERRIDING SYSTEM VALUE
    VALUES (
      2147000111, 'Conflicting routing fixture',
      'conflicting-routing-fixture', 'other-routing.test', 'active'
    );
    INSERT INTO site_settings (
      id, tenant_id, site_name, site_url
    )
    OVERRIDING SYSTEM VALUE
    VALUES (
      2147000113, 2147000111, 'Conflicting routing fixture',
      'https://other-routing.test'
    );
    INSERT INTO site_settings_aliases (
      _order, _parent_id, id, host
    )
    VALUES (
      1, 2147000113, 'historical-routing-conflicting-www',
      'www.ami-care.nl'
    );
  `)
}

describe("durable pre-commerce routing adoption migration", () => {
  it("no-ops on a database without the historical tenant", async () => {
    const args = await migrationArgs()
    await removeRoutingAdoptionSchema(args)
    await expect(applyRoutingAdoptionSchema(args)).resolves.toBeUndefined()

    const rows = await payload.find({
      collection: "tenants",
      where: {
        "preCommerceRoutingAdoption.state": { equals: "adopted" },
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    expect(rows.totalDocs).toBe(0)

    const ordinaryTenant = await payload.create({
      collection: "tenants",
      data: {
        name: "Ordinary post-migration tenant",
        slug: "ordinary-post-migration-tenant",
        domain: "ordinary-post-migration.test",
        status: "provisioning",
      },
      depth: 0,
      overrideAccess: true,
    })
    expect(ordinaryTenant.preCommerceRoutingAdoption).toMatchObject({
      state: "not_adopted",
    })
    await expect(executeRaw(`
      UPDATE tenants
      SET pre_commerce_routing_adoption_state = 'adopted'
      WHERE id = ${Number(ordinaryTenant.id)};
    `)).rejects.toThrow("Failed query")
    await expect(executeRaw(`
      UPDATE tenants
      SET
        pre_commerce_routing_adoption_state = 'adopted',
        pre_commerce_routing_adoption_adopted_domain = NULL,
        pre_commerce_routing_adoption_evidence_version =
          'pre-commerce-routing-v1',
        pre_commerce_routing_adoption_adopted_at = now()
      WHERE id = ${Number(ordinaryTenant.id)};
    `)).rejects.toThrow("Failed query")
    await expect(executeRaw(`
      UPDATE tenants
      SET
        pre_commerce_routing_adoption_state = 'adopted',
        pre_commerce_routing_adoption_adopted_domain =
          'ordinary-post-migration.test',
        pre_commerce_routing_adoption_evidence_version = NULL,
        pre_commerce_routing_adoption_adopted_at = now()
      WHERE id = ${Number(ordinaryTenant.id)};
    `)).rejects.toThrow("Failed query")
    await expect(executeRaw(`
      UPDATE tenants
      SET
        pre_commerce_routing_adoption_state = 'revoked',
        pre_commerce_routing_adoption_adopted_domain = NULL,
        pre_commerce_routing_adoption_evidence_version =
          'pre-commerce-routing-v1',
        pre_commerce_routing_adoption_adopted_at = now(),
        pre_commerce_routing_adoption_revoked_at = now()
      WHERE id = ${Number(ordinaryTenant.id)};
    `)).rejects.toThrow("Failed query")
    await expect(executeRaw(`
      UPDATE tenants
      SET
        pre_commerce_routing_adoption_state = 'revoked',
        pre_commerce_routing_adoption_adopted_domain =
          'ordinary-post-migration.test',
        pre_commerce_routing_adoption_evidence_version = NULL,
        pre_commerce_routing_adoption_adopted_at = now(),
        pre_commerce_routing_adoption_revoked_at = now()
      WHERE id = ${Number(ordinaryTenant.id)};
    `)).rejects.toThrow("Failed query")
    await payload.delete({
      collection: "tenants",
      id: ordinaryTenant.id,
      depth: 0,
      overrideAccess: true,
    })
  })

  it("adopts only the exact verified historical shape and rejects managed-domain precedence", async () => {
    const args = await migrationArgs()
    await removeRoutingAdoptionSchema(args)
    try {
      await seedHistoricalAmiCare()
      await executeRaw(`
        ALTER TABLE managed_domains DISABLE TRIGGER ALL;
        INSERT INTO managed_domains (
          domain_name_ascii, tld, provisioning_idempotency_key,
          originating_order_id, registrant_profile_id, initial_operation
        )
        VALUES (
          'ami-care.nl', 'nl', 'historical-routing-managed-domain',
          2147000190, 2147000191, 'registration'
        );
        ALTER TABLE managed_domains ENABLE TRIGGER ALL;
      `)
      await expect(applyRoutingAdoptionSchema(args)).rejects.toThrow(
        "Historical ami-care.nl routing adoption evidence is incomplete",
      )
      await executeRaw(`
        DELETE FROM managed_domains
        WHERE provisioning_idempotency_key =
          'historical-routing-managed-domain';
      `)

      await seedConflictingWwwOwner()
      await expect(applyRoutingAdoptionSchema(args)).rejects.toThrow(
        "Historical ami-care.nl routing adoption evidence is incomplete",
      )
      const failedSchema = rowsFrom<{
        adoption_type: string | null
        adoption_column: string | null
      }>(await executeRaw(`
        SELECT
          to_regtype(
            'public.enum_tenants_pre_commerce_routing_adoption_state'
          )::text AS adoption_type,
          (
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'tenants'
              AND column_name =
                'pre_commerce_routing_adoption_adopted_domain'
          ) AS adoption_column;
      `))
      expect(failedSchema).toEqual([{
        adoption_type: null,
        adoption_column: null,
      }])
      await executeRaw(`
        DELETE FROM site_settings_aliases
        WHERE id = 'historical-routing-conflicting-www';
        DELETE FROM site_settings
        WHERE id = 2147000113;
        DELETE FROM tenants
        WHERE id = 2147000111;
      `)

      await expect(applyRoutingAdoptionSchema(args)).resolves.toBeUndefined()
      const constraints = rowsFrom<{ definition: string }>(
        await executeRaw(`
          SELECT pg_get_constraintdef(oid) AS definition
          FROM pg_constraint
          WHERE conname =
            'tenants_pre_commerce_routing_adoption_evidence_check';
        `),
      )
      expect(constraints).toHaveLength(1)
      expect(constraints[0]?.definition).toContain(
        "pre_commerce_routing_adoption_adopted_domain",
      )
      const rows = await payload.find({
        collection: "tenants",
        where: { domain: { equals: "ami-care.nl" } },
        limit: 2,
        depth: 0,
        overrideAccess: true,
      })
      expect(rows.docs).toHaveLength(1)
      expect(rows.docs[0]?.preCommerceRoutingAdoption).toMatchObject({
        state: "adopted",
        adoptedDomain: "ami-care.nl",
        evidenceVersion: "pre-commerce-routing-v1",
        revokedAt: null,
      })
      expect(rows.docs[0]?.preCommerceRoutingAdoption?.adoptedAt).toBeTruthy()
      await expect(executeRaw(`
        UPDATE tenants
        SET domain = 'retargeted.example'
        WHERE id = 2147000101;
      `)).rejects.toThrow("Failed query")
      await expect(removeRoutingAdoptionSchema(args)).rejects.toThrow(
        "Cannot remove durable pre-commerce routing adoption evidence",
      )
      await executeRaw(`
        UPDATE tenants
        SET
          pre_commerce_routing_adoption_state = 'revoked',
          pre_commerce_routing_adoption_revoked_at = now()
        WHERE id = 2147000101;
      `)
      await expect(removeRoutingAdoptionSchema(args)).rejects.toThrow(
        "Cannot remove durable pre-commerce routing adoption evidence",
      )
    } finally {
      await cleanHistoricalAmiCare()
      await removeRoutingAdoptionSchema(args).catch(() => undefined)
      await applyRoutingAdoptionSchema(args)
    }
  })
})
