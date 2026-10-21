import { writeFile } from "node:fs/promises"
import path from "node:path"
import { randomBytes } from "node:crypto"
import { sql } from "@payloadcms/db-postgres"
import { getTestPayload } from "../integration/_helpers"

// The shared helper validates resource/storage ownership before configuration
// imports, then initializes only that disposable DB using committed migrations.
const payload = await getTestPayload()
try {
  const password = "siab-test-" + randomBytes(20).toString("hex")
  const tenants = []
  const owners = []
  const pages = []
  for (const name of ["one", "two"]) {
    const tenant = await payload.create({ collection: "tenants", overrideAccess: true,
      context: { skipProjection: true },
      data: { name: "Browser fixture " + name, slug: "m13-" + name, domain: "m13-" + name + ".test", status: "active" } })
    // Explicit synthetic legacy routing evidence, not real DNS, entitlement or
    // Amicare adoption proof. Runtime routing still checks these real stored
    // fields and the actual active snapshot. The shared guard owns this DB.
    await payload.db.drizzle.execute(sql`UPDATE tenants SET
      domain_verification_status='verified',
      pre_commerce_routing_adoption_state='adopted',
      pre_commerce_routing_adoption_adopted_domain=domain,
      pre_commerce_routing_adoption_evidence_version='pre-commerce-routing-v1',
      pre_commerce_routing_adoption_adopted_at=now(),
      pre_commerce_routing_adoption_revoked_at=NULL
      WHERE id=${tenant.id} AND domain=${tenant.domain}`)
    const owner = await payload.create({ collection: "users", overrideAccess: true,
      data: { name: "Browser owner " + name, email: "m13-" + name + "@test.invalid", password, role: "owner", tenants: [{ tenant: tenant.id }] } })
    const page = await payload.create({ collection: "pages", overrideAccess: true,
      data: { tenant: tenant.id, title: "Browser initial " + name, slug: "index", status: name === "one" ? "published" : "draft",
        blocks: [{ blockType: "hero", variant: "hero-01", heading: "Published browser fixture " + name,
          body: "Synthetic published content", primaryAction: { label: "Contact", href: "#contact" } }] } })
    tenants.push({ id: tenant.id, domain: tenant.domain })
    owners.push({ id: owner.id, email: owner.email })
    pages.push({ id: page.id, title: page.title, updatedAt: page.updatedAt })
  }
  const draft = await payload.create({ collection: "pages", overrideAccess: true,
    data: { tenant: tenants[0]!.id, title: "Private browser draft", slug: "private-browser-draft", status: "draft",
      blocks: [{ blockType: "hero", variant: "hero-01", heading: "PRIVATE-M13-DRAFT-SECRET",
        body: "Never publish this fixture", primaryAction: { label: "Private", href: "#private" } }] } })
  await writeFile(path.join(process.env.DATA_DIR!, "browser-fixture.json"), JSON.stringify({ password, tenants, owners, pages, draftId: draft.id }), { mode: 0o600, flag: "wx" })
  console.log("Guarded built-browser fixtures initialized with committed migrations")
} finally {
  await payload.destroy()
}

// Payload is closed above; terminate unrelated SDK maintenance timers in this
// one-shot fixture child, without sharing them with the application servers.
process.exit(0)
