import "server-only"
import type { Payload } from "payload"
import { relationshipId } from "@/lib/relationshipId"
import { CustomerIdentityError } from "@/lib/auth/verifiedCustomer"
import type { BuilderSession } from "@/payload-types"
import {
  BuilderFactsSchema,
  type BuilderFacts,
} from "./facts"
import {
  BuilderChatMessageSchema,
  BuilderLegalSchema,
  BuilderThreadSchema,
  defaultBuilderMessages,
  legalIsAccepted,
  messagesForBuilderSession,
  normalizeBuilderEmail,
  type BuilderChatMessage,
  type BuilderLegal,
  type BuilderThread,
} from "./thread"

const COLLECTION = "builder-sessions" as const

const parseMessages = (value: unknown): BuilderChatMessage[] => {
  if (!Array.isArray(value)) return defaultBuilderMessages()
  const messages: BuilderChatMessage[] = []
  for (const item of value) {
    const parsed = BuilderChatMessageSchema.safeParse(item)
    if (parsed.success) messages.push(parsed.data)
  }
  return messages.length > 0 ? messages.slice(-200) : defaultBuilderMessages()
}

const parseLegal = (value: unknown): BuilderLegal | null => {
  const parsed = BuilderLegalSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

const parseFacts = (value: unknown): BuilderFacts | null => {
  if (value == null) return null
  const parsed = BuilderFactsSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

const toThread = (doc: BuilderSession): BuilderThread | null => {
  const legal = parseLegal(doc.legal)
  if (!legal) return null
  const clientSlug = typeof doc.clientSlug === "string" && doc.clientSlug.trim() ? doc.clientSlug.trim() : null
  const parsed = BuilderThreadSchema.safeParse({
    customerEmail: normalizeBuilderEmail(doc.customerEmail),
    displayName: doc.displayName,
    contactPhone: doc.contactPhone ?? "",
    legal,
    messages: messagesForBuilderSession(parseMessages(doc.messages), clientSlug),
    facts: parseFacts(doc.facts),
    clientSlug,
  })
  return parsed.success ? parsed.data : null
}

export async function loadBuilderThread(payload: Payload, email: string, customerAccountId?: number): Promise<BuilderThread | null> {
  const customerEmail = normalizeBuilderEmail(email)
  if (!customerEmail) return null
  const result = await payload.find({
    collection: COLLECTION,
    where: { customerEmail: { equals: customerEmail } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = result.docs[0] as BuilderSession | undefined
  if (doc) {
    const bound = relationshipId(doc.customerAccount)
    if (bound && bound !== String(customerAccountId)) throw new CustomerIdentityError("E_CUSTOMER_IDENTITY_CONFLICT")
    if (customerAccountId && !bound) await payload.update({ collection: COLLECTION, id: doc.id,
      data: { customerAccount: customerAccountId }, depth: 0, overrideAccess: true })
  }
  return doc ? toThread(doc) : null
}

export async function upsertBuilderRegistration(
  payload: Payload,
  input: {
    email: string
    displayName: string
    contactPhone?: string
    legal: BuilderLegal
  },
): Promise<void> {
  const customerEmail = normalizeBuilderEmail(input.email)
  const legal = BuilderLegalSchema.parse(input.legal)
  if (!legalIsAccepted(legal)) {
    throw new Error("legal_required")
  }
  const existing = await payload.find({
    collection: COLLECTION,
    where: { customerEmail: { equals: customerEmail } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: { customerEmail: true },
  })
  // Registration is not authentication and must neither read private thread
  // content nor overwrite existing work, names, legal evidence or bindings.
  if (existing.docs.length) return
  const data = {
    customerEmail,
    displayName: input.displayName.trim(),
    contactPhone: input.contactPhone?.trim() ?? "",
    legal,
    messages: defaultBuilderMessages(),
    facts: null,
    clientSlug: null,
  }
  try { await payload.create({ collection: COLLECTION, data, depth: 0, overrideAccess: true }) }
  catch (error) {
    const winner = await payload.find({ collection: COLLECTION, where: { customerEmail: { equals: customerEmail } },
      limit: 1, depth: 0, overrideAccess: true, select: { customerEmail: true } })
    if (!winner.docs.length) throw error
  }
}

export async function saveBuilderThread(
  payload: Payload,
  thread: BuilderThread,
  customerAccountId?: number,
): Promise<BuilderThread> {
  const parsed = BuilderThreadSchema.parse({
    ...thread,
    customerEmail: normalizeBuilderEmail(thread.customerEmail),
    messages: thread.messages.slice(-200),
  })
  const existing = await payload.find({
    collection: COLLECTION,
    where: { customerEmail: { equals: parsed.customerEmail } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const current = existing.docs[0] as BuilderSession | undefined
  if (current?.customerAccount && relationshipId(current.customerAccount) !== String(customerAccountId)) {
    throw new CustomerIdentityError("E_CUSTOMER_IDENTITY_CONFLICT")
  }
  const data = {
    customerEmail: parsed.customerEmail,
    displayName: parsed.displayName,
    contactPhone: parsed.contactPhone,
    legal: parsed.legal,
    messages: parsed.messages,
    facts: parsed.facts,
    clientSlug: parsed.clientSlug,
    ...(customerAccountId ? { customerAccount: customerAccountId } : {}),
  }
  const doc = current
    ? await payload.update({ collection: COLLECTION, id: current.id, data, depth: 0, overrideAccess: true })
    : await payload.create({ collection: COLLECTION, data, depth: 0, overrideAccess: true })
  const saved = toThread(doc as BuilderSession)
  if (!saved) throw new Error("builder_session_invalid")
  return saved
}
