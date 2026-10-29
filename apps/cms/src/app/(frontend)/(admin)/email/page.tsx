import { CustomerEmailWorkspace } from "./CustomerEmailWorkspace"
import { requireMailWorkspace } from "./workspaceAccess"
export const dynamic = "force-dynamic"
export default async function CustomerEmailPage({ searchParams }: { searchParams: Promise<{ request?: string | string[]; new?: string }> }) {
  return <CustomerEmailWorkspace workspace={await requireMailWorkspace()} searchParams={searchParams} />
}
