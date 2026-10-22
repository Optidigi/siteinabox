import { writeFile } from "node:fs/promises"
import path from "node:path"
import { randomBytes } from "node:crypto"
import { sql } from "@payloadcms/db-postgres"
import { getTestPayload } from "../integration/_helpers"
import { createArgs } from "../_helpers/payloadApi"
import { boundWorkspace, securedPayment } from "../_helpers/privateWorkspaceFixture"
import { publishCurrentTenantState } from "@/lib/publish/currentState"
import { BuilderFactsSchema } from "@/lib/builder/facts"

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
  await publishCurrentTenantState(payload, { tenantId: tenants[0]!.id, user: { id: owners[0]!.id, role: "super-admin" },
    reason: "Isolated existing-live browser baseline" })
  const privateWorkspace = await boundWorkspace(payload, "m16-paid-private", null, password)
  await securedPayment(payload, privateWorkspace.tenant.id, privateWorkspace.user.email)
  await payload.create(createArgs("site-settings", {
    tenant: privateWorkspace.tenant.id, siteName: "Private paid browser fixture", siteUrl: null,
    navigation: { primary: [], footer: [] },
  }, { overrideAccess: true, context: { skipProjection: true } }))
  const privateRoles = []
  for (const role of ["editor", "viewer"] as const) {
    const person = await payload.create({ collection: "users", overrideAccess: true, data: {
      name: "Private paid " + role, email: "m16-private-" + role + "@test.invalid", password, role,
      tenants: [{ tenant: privateWorkspace.tenant.id }],
    } })
    privateRoles.push({ id: person.id, email: person.email, role })
  }
  const draft = await payload.create({ collection: "pages", overrideAccess: true,
    data: { tenant: tenants[0]!.id, title: "Private browser draft", slug: "private-browser-draft", status: "draft",
      blocks: [{ blockType: "hero", variant: "hero-01", heading: "PRIVATE-M13-DRAFT-SECRET",
        body: "Never publish this fixture", primaryAction: { label: "Private", href: "#private" } }] } })
  const roles = []
  for (const role of ["editor", "viewer", "super-admin"] as const) {
    const user = await payload.create({ collection: "users", overrideAccess: true,
      data: { name: "Synthetic Amicare-compatible " + role, email: "m14-" + role + "@test.invalid", password, role,
        ...(role === "super-admin" ? {} : { tenants: [{ tenant: tenants[0]!.id }] }) } })
    roles.push({ id: user.id, email: user.email, role })
  }
  const freeEmail = "m14-free@test.invalid"
  const facts = BuilderFactsSchema.parse({
    businessName: "M14 Schilders Breda", intro: "Wij schilderen woningen voor lokale klanten in Breda en omgeving.",
    offers: [{ value: "Binnenschilderwerk" }, { value: "Buitenschilderwerk" }],
    audience: "Lokale particuliere klanten in Breda", situation: "Klanten zoeken duidelijke afspraken en zorgvuldig schilderwerk.",
    approach: "We bespreken de wensen en werken zorgvuldig met een heldere planning.", region: "Breda", notes: "",
    selectedActions: ["message"], formType: "message", briefStage: "ready", lookConfirmed: true,
  })
  await payload.create({ collection: "builder-sessions", overrideAccess: true,
    data: { customerEmail: freeEmail, displayName: "M14 Free customer",
      legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false },
      facts, messages: [{ role: "user", text: "Synthetic saved brief for this customer." }], clientSlug: null } })
  await writeFile(path.join(process.env.DATA_DIR!, "browser-fixture.json"), JSON.stringify({ password, tenants, owners, pages,
    draftId: draft.id, roles, freeEmail, privateWorkspace: {
      tenantId: privateWorkspace.tenant.id, pageId: privateWorkspace.page.id, userId: privateWorkspace.user.id, email: privateWorkspace.user.email, roles: privateRoles,
    } }), { mode: 0o600, flag: "wx" })
  console.log("Guarded built-browser fixtures initialized with committed migrations")
} finally {
  await payload.destroy()
}

// Payload is closed above; terminate unrelated SDK maintenance timers in this
// one-shot fixture child, without sharing them with the application servers.
process.exit(0)
