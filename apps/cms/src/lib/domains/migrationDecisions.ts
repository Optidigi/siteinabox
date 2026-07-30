import type { DomainMigration } from "@/payload-types"

export type MigrationEntryDecision =
  | { outcome: "continue" }
  | {
      outcome: "waiting" | "manual_review" | "completed"
      status: "waiting" | "completed" | "rolled_back" | "failed"
      message: string
    }

export function classifyMigrationEntry(
  migration: Pick<
    DomainMigration,
    | "state"
    | "sourceZoneSnapshot"
    | "targetZoneSnapshot"
    | "rollbackEvidence"
    | "encryptedTransferCode"
    | "providerTransferState"
  >,
): MigrationEntryDecision {
  if (migration.state === "completed") {
    return {
      outcome: "completed",
      status: "completed",
      message: "Migration is complete.",
    }
  }
  if (migration.state === "rolled_back") {
    return {
      outcome: "completed",
      status: "rolled_back",
      message: "Migration is rolled back.",
    }
  }
  if (migration.state === "custom_quote_required") {
    return {
      outcome: "manual_review",
      status: "failed",
      message:
        "Complex migration requires a custom quote and cannot continue automatically.",
    }
  }
  if (migration.state === "paused_supplemental_order") {
    return {
      outcome: "waiting",
      status: "waiting",
      message: "Migration is paused for authorized operator work.",
    }
  }
  if (migration.state === "awaiting_customer" && !migration.sourceZoneSnapshot) {
    return {
      outcome: "waiting",
      status: "waiting",
      message:
        "A complete authoritative zone export and transfer code are required.",
    }
  }
  if (
    !migration.sourceZoneSnapshot ||
    !migration.targetZoneSnapshot ||
    !migration.rollbackEvidence ||
    (
      !migration.encryptedTransferCode &&
      migration.providerTransferState !== "confirmed"
    )
  ) {
    return {
      outcome: "waiting",
      status: "waiting",
      message: "Frozen migration preparation evidence is incomplete.",
    }
  }
  return { outcome: "continue" }
}
