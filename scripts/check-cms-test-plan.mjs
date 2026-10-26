import { fileURLToPath } from "node:url"
import { cmsTestPlan, cmsTestPartitions } from "../apps/cms/tests/_helpers/testPlan.mjs"
const plan = cmsTestPlan(fileURLToPath(new URL("../apps/cms", import.meta.url)))
const selected = cmsTestPartitions.flatMap(part => plan.partitions[part])
if (new Set(cmsTestPartitions).size !== 4 || selected.length !== plan.files.length || new Set(selected).size !== plan.files.length ||
  cmsTestPartitions.some(part => !/^(?:unit|integration)-[12]$/.test(part))) throw new Error("CMS test partitions overlap, omit files, or drift from the governed topology")
console.log(`Canonical CMS inventory: ${plan.files.length} Vitest files, ${plan.pure.length} pure provider files, four nonoverlapping partitions`)
