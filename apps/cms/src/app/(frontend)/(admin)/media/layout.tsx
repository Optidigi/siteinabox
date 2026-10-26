import { requireWebsiteAccess } from "@/lib/workspace/websiteAccess"

export default async function WebsiteLayout({ children }: { children: React.ReactNode }) {
  await requireWebsiteAccess()
  return children
}
