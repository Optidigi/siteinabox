import type { Payload } from "payload"

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

export type MockFindByIdArgs = MockFindArgs & { id: number | string }

export function matchesWhere(doc: MockDoc, where: MockWhere | undefined): boolean {
  if (!where) return true
  if (Array.isArray(where.and)) {
    return where.and.every((entry) => matchesWhere(doc, entry))
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
