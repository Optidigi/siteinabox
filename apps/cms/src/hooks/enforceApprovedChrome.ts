import type { CollectionBeforeValidateHook } from "payload"
import type { SiteSetting } from "@/payload-types"
import { approvedChromeIssues } from "@/lib/sitegen/catalog"

/** Keep unchanged legacy chrome repairable; never accept a new unavailable design. */
export const enforceApprovedChrome: CollectionBeforeValidateHook<SiteSetting> = ({ data, originalDoc }) => {
  if (data?.chrome === undefined) return data
  const issues = approvedChromeIssues(data.chrome)
  if (issues.length && JSON.stringify(data.chrome) !== JSON.stringify(originalDoc?.chrome)) throw new Error(issues.join(" "))
  return data
}
