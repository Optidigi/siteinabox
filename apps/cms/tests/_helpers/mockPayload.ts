import type { Payload } from "payload"
import { vi } from "vitest"

export type MockDoc = Record<string, unknown> & { id?: number | string }
export type StoredDoc = MockDoc & { id: number }

export type MockWhere = Record<string, unknown> & {
  and?: MockWhere[]
  or?: MockWhere[]
  tenant?: { equals?: number | string }
  createdAt?: { less_than?: string }
  notificationKey?: { equals?: string }
}

export type FindArgs = MockFindArgs
export type CreateArgs = MockCreateArgs
export type UpdateArgs = MockUpdateArgs

export type MockFindArgs = {
  collection: string
  where?: MockWhere
  limit?: number
  page?: number
  sort?: string
  depth?: number
  overrideAccess?: boolean
}

export type MockCreateArgs = {
  collection: string
  data: Record<string, unknown>
  depth?: number
  overrideAccess?: boolean
  user?: unknown
  context?: Record<string, unknown>
  filePath?: string
  overwriteExistingFiles?: boolean
}

export type MockUpdateArgs = {
  collection: string
  id: number | string
  data: Record<string, unknown>
  depth?: number
  overrideAccess?: boolean
  user?: unknown
  context?: Record<string, unknown>
}

export type MutableMockUpdateArgs = Omit<MockUpdateArgs, "id"> & {
  id?: number | string
  where?: MockWhere
}

export type MockFindByIdArgs = MockFindArgs & { id: number | string }

export function matchesWhere(doc: MockDoc, where: MockWhere | undefined): boolean {
  if (!where) return true
  if (Array.isArray(where.and)) {
    return where.and.every((entry) => matchesWhere(doc, entry))
  }
  if (Array.isArray(where.or)) {
    return where.or.some((entry) => matchesWhere(doc, entry))
  }
  return Object.entries(where).every(([field, condition]) => {
    if (field === "and") return true
    if (condition && typeof condition === "object" && "equals" in condition) {
      return String(doc[field]) === String((condition as { equals?: unknown }).equals)
    }
    if (condition && typeof condition === "object" && "in" in condition) {
      const values = (condition as { in?: unknown[] }).in ?? []
      return values.map(String).includes(String(doc[field]))
    }
    if (condition && typeof condition === "object" && "not_in" in condition) {
      const values = (condition as { not_in?: unknown[] }).not_in ?? []
      return !values.map(String).includes(String(doc[field]))
    }
    if (condition && typeof condition === "object" && "exists" in condition) {
      const exists = doc[field] !== undefined && doc[field] !== null
      return exists === Boolean((condition as { exists?: unknown }).exists)
    }
    if (condition && typeof condition === "object" && "less_than_equal" in condition) {
      return String(doc[field]) <= String(
        (condition as { less_than_equal?: unknown }).less_than_equal,
      )
    }
    if (condition && typeof condition === "object" && "less_than" in condition) {
      return String(doc[field]) < String(
        (condition as { less_than?: unknown }).less_than,
      )
    }
    if (condition && typeof condition === "object" && "greater_than_equal" in condition) {
      return String(doc[field]) >= String(
        (condition as { greater_than_equal?: unknown }).greater_than_equal,
      )
    }
    return doc[field] === condition
  })
}

export function asPayload<T extends object>(value: T): Payload {
  return value as unknown as Payload
}

export function docAt(docs: MockDoc[], index = 0): MockDoc {
  const doc = docs[index]
  if (!doc) throw new Error(`Expected docs[${index}]`)
  return doc
}

export function mockPaginatedFind(corpus: MockDoc[]) {
  const calls: MockFindArgs[] = []
  const find = async (args: MockFindArgs) => {
    calls.push(args)
    const where = args.where ?? {}
    let docs = corpus.slice()
    if (where.tenant?.equals !== undefined) {
      docs = docs.filter((doc) => doc.tenant === where.tenant?.equals)
    }
    const limit = args.limit ?? 50
    const page = args.page ?? 1
    const start = (page - 1) * limit
    const slice = docs.slice(start, start + limit)
    const totalDocs = docs.length
    const totalPages = Math.max(1, Math.ceil(totalDocs / limit))
    return {
      docs: slice,
      totalDocs,
      totalPages,
      page,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    }
  }
  return { find, calls }
}

export type MutablePayloadUniqueConstraint = {
  collection: string
  fields: string[]
}

export type MutablePayloadStoreHooks = {
  beforeCreate?: (
    args: MockCreateArgs,
    collections: Record<string, MockDoc[]>,
  ) => void | Promise<void>
  beforeUpdate?: (
    args: MutableMockUpdateArgs,
    collections: Record<string, MockDoc[]>,
  ) => void | Promise<void>
}

export function createMutablePayloadStore(input: {
  collections: Record<string, MockDoc[]>
  nextId?: number
  unique?: MutablePayloadUniqueConstraint[]
  hooks?: MutablePayloadStoreHooks
}) {
  const collections = input.collections
  let nextId = input.nextId ?? 1_000
  let transactionSnapshot: Record<string, MockDoc[]> | null = null

  const find = vi.fn(async ({ collection, where, sort, limit }: MockFindArgs) => {
    let docs = (collections[collection] ?? []).filter((doc) =>
      matchesWhere(doc, where))
    if (sort) {
      const descending = sort.startsWith("-")
      const field = descending ? sort.slice(1) : sort
      docs = [...docs].sort((left, right) => {
        const leftValue = left[field]
        const rightValue = right[field]
        const compared =
          typeof leftValue === "number" && typeof rightValue === "number"
            ? leftValue - rightValue
            : String(leftValue ?? "").localeCompare(String(rightValue ?? ""))
        return descending ? -compared : compared
      })
    }
    if (limit != null) docs = docs.slice(0, limit)
    return { docs, totalDocs: docs.length }
  })

  const findByID = vi.fn(async ({ collection, id }: MockFindByIdArgs) => {
    const doc = (collections[collection] ?? []).find(
      (entry) => String(entry.id) === String(id),
    )
    if (!doc) throw new Error(`Missing ${collection} ${id}`)
    return doc
  })

  const create = vi.fn(async (args: MockCreateArgs) => {
    await input.hooks?.beforeCreate?.(args, collections)
    const constraints = (input.unique ?? []).filter(
      (constraint) => constraint.collection === args.collection,
    )
    for (const constraint of constraints) {
      const duplicate = (collections[args.collection] ?? []).some((doc) =>
        constraint.fields.every(
          (field) => String(doc[field]) === String(args.data[field]),
        ))
      if (duplicate) {
        throw new Error(
          `duplicate key value violates ${args.collection}.${constraint.fields.join("_")}`,
        )
      }
    }
    const doc = { id: nextId++, ...args.data }
    ;(collections[args.collection] ??= []).push(doc)
    return doc
  })

  const update = vi.fn(async (args: MutableMockUpdateArgs) => {
    await input.hooks?.beforeUpdate?.(args, collections)
    if (args.where) {
      const docs = (collections[args.collection] ?? []).filter((doc) =>
        matchesWhere(doc, args.where))
      for (const doc of docs) Object.assign(doc, args.data)
      return { docs, totalDocs: docs.length }
    }
    if (args.id == null) {
      throw new Error(`Update for ${args.collection} requires id or where.`)
    }
    const doc = (collections[args.collection] ?? []).find(
      (entry) => String(entry.id) === String(args.id),
    )
    if (!doc) throw new Error(`Missing ${args.collection} ${args.id}`)
    Object.assign(doc, args.data)
    return doc
  })

  const beginTransaction = vi.fn(async () => {
    if (transactionSnapshot) throw new Error("A test transaction is already active.")
    transactionSnapshot = structuredClone(collections)
    return "test-transaction"
  })
  const commitTransaction = vi.fn(async () => {
    if (!transactionSnapshot) throw new Error("No test transaction is active.")
    transactionSnapshot = null
  })
  const rollbackTransaction = vi.fn(async () => {
    if (!transactionSnapshot) throw new Error("No test transaction is active.")
    for (const collection of Object.keys(collections)) delete collections[collection]
    Object.assign(collections, transactionSnapshot)
    transactionSnapshot = null
  })

  return {
    collections,
    payload: asPayload({
      find,
      findByID,
      create,
      update,
      db: {
        beginTransaction,
        commitTransaction,
        rollbackTransaction,
      },
      jobs: { queue: vi.fn() },
      logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
    }),
    find,
    findByID,
    create,
    update,
    beginTransaction,
    commitTransaction,
    rollbackTransaction,
  }
}
