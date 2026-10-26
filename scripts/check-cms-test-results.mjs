import { readFile, readdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { cmsTestPlan, cmsTestPartitions } from "../apps/cms/tests/_helpers/testPlan.mjs"

export function assertCmsTestReceipts(receipts, plan, identity) {
  if (receipts.length !== cmsTestPartitions.length || new Set(receipts.map(item => item.part)).size !== cmsTestPartitions.length) throw new Error("Every CMS partition must have exactly one receipt")
  for (const part of cmsTestPartitions) {
    const receipt = receipts.find(item => item.part === part)
    if (!receipt || receipt.version !== 1 || receipt.status !== "passed" || receipt.sourceSHA !== identity.sourceSHA ||
        receipt.qualification !== (identity.runId ? "hosted-canonical" : "local-diagnostic") ||
        identity.runId && receipt.sourceDirty !== false || receipt.runId !== identity.runId || receipt.runAttempt !== identity.runAttempt || receipt.planHash !== plan.hash ||
        JSON.stringify(receipt.selected) !== JSON.stringify(plan.partitions[part]) ||
        JSON.stringify(receipt.pure) !== JSON.stringify(part === "unit-1" ? plan.pure : []) ||
        (part === "unit-1" ? !(receipt.pureCount > 0) : receipt.pureCount !== 0) ||
        receipt.counts?.files !== plan.partitions[part].length || !(receipt.counts?.tests > 0)) throw new Error("Missing, failed, stale or substituted CMS partition: " + part)
  }
}

export async function loadCmsTestReceipts(root) {
  const directory = path.join(root, "artifacts/cms-tests"), receipts = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) receipts.push(JSON.parse(await readFile(path.join(directory, entry.name, "receipt.json"), "utf8")))
  }
  return receipts
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("..", import.meta.url))
  const receipts = await loadCmsTestReceipts(root)
  assertCmsTestReceipts(receipts, cmsTestPlan(path.join(root, "apps/cms")), {
    sourceSHA: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    runId: process.env.GITHUB_RUN_ID ?? null, runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  })
  console.log("Every CMS test file passed exactly one isolated partition; pure provider tests passed")
}
