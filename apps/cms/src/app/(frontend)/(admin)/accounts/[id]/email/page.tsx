import { CustomerEmailWorkspace } from "../../../email/CustomerEmailWorkspace"
import { requireMailWorkspace } from "../../../email/workspaceAccess"
export const dynamic = "force-dynamic"
export default async function OperatorEmailPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ request?: string | string[]; new?: string; legalLocale?: string | string[] }>
}) {
  return <CustomerEmailWorkspace workspace={await requireMailWorkspace((await params).id)} searchParams={searchParams} />
}
