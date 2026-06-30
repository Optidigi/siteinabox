import { NextResponse, type NextRequest } from "next/server"
import { searchKvk, validateKvkSearchQuery } from "@/lib/intake/kvk"

async function handleSearch(query: unknown) {
  const validated = validateKvkSearchQuery(query)
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  const result = await searchKvk(validated.query)
  return NextResponse.json(result.data, { status: result.status })
}

export async function GET(req: NextRequest) {
  return handleSearch(req.nextUrl.searchParams.get("q"))
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  return handleSearch(body?.query)
}
