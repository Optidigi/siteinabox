import "server-only"

import crypto from "node:crypto"
import type { Payload } from "payload"
import type { IntakeLegalMetadata } from "@siteinabox/contracts/generation"
import { legalStatements } from "@/lib/legal/statements"

const findOne = async (payload: Payload, collection: string, where: Record<string, unknown>) => {
  const result = await payload.find({
    collection: collection as any,
    where: where as any,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (result.docs[0] as Record<string, any> | undefined) ?? null
}

export async function recordIntakeMarketingPreference(input: {
  payload: Payload
  intakeId: string | number
  email: string
  legal: IntakeLegalMetadata
}) {
  const email = input.email.trim().toLowerCase()
  const subjectKey = `email:${crypto.createHash("sha256").update(email).digest("hex")}`
  let preference = await findOne(input.payload, "communication-preferences", { subjectKey: { equals: subjectKey } })
  const granted = input.legal.marketingConsent.granted
  if (!preference) {
    preference = await input.payload.create({
      collection: "communication-preferences" as any,
      data: {
        subjectKey,
        email,
        marketing: granted,
        directory: false,
        suppressed: false,
        statementVersion: input.legal.marketingConsent.statementVersion,
        updatedAt: input.legal.marketingConsent.recordedAt,
      },
      depth: 0,
      overrideAccess: true,
    } as any) as Record<string, any>
  } else {
    preference = await input.payload.update({
      collection: "communication-preferences" as any,
      id: preference.id,
      data: {
        marketing: granted,
        suppressed: granted ? false : preference.suppressed === true,
        statementVersion: input.legal.marketingConsent.statementVersion,
        updatedAt: input.legal.marketingConsent.recordedAt,
      },
      depth: 0,
      overrideAccess: true,
    } as any) as Record<string, any>
  }

  const eventKey = `intake:${input.intakeId}:marketing`
  const existingEvent = await findOne(input.payload, "communication-preference-events", { eventKey: { equals: eventKey } })
  if (!existingEvent) {
    await input.payload.create({
      collection: "communication-preference-events" as any,
      data: {
        eventKey,
        preference: preference.id,
        preferenceType: "marketing",
        action: granted ? "opt_in" : "opt_out",
        statementVersion: input.legal.marketingConsent.statementVersion,
        statementText: legalStatements.marketingOptIn.text,
        source: "public-intake",
        occurredAt: input.legal.marketingConsent.recordedAt,
      },
      depth: 0,
      overrideAccess: true,
    } as any)
  }
  return preference
}

