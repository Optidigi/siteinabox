import { NextResponse, type NextRequest } from "next/server"
import { getKvkProfile, validateKvkNumber } from "@/lib/intake/kvk"

async function handleProfile(kvkNumber: unknown) {
  const validated = validateKvkNumber(kvkNumber)
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  const result = await getKvkProfile(validated.kvkNumber)
  return NextResponse.json(result.data, { status: result.status })
}

export async function GET(req: NextRequest) {
  return handleProfile(req.nextUrl.searchParams.get("kvkNumber"))
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  return handleProfile(body?.kvkNumber)
}
