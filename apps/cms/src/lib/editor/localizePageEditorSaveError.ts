/**
 * Map known English publish/activation gate reasons (thrown from
 * `canActivatePublishedSnapshot` / page-editor-save) to editor i18n keys.
 * Saving is private; publication requires the separate explicit action.
 */
export const PUBLISH_GATE_ERROR_KEYS: Record<string, string> = {
  "Page was updated elsewhere; reload and try again.": "saveConflict",
  "Site theme was updated elsewhere; reload and try again.": "saveThemeConflict",
  "Reload the editor to save privately or publish explicitly.": "saveReloadRequired",
  "Activation requires verified domain ownership.": "publishErrorDomain",
  "Cannot activate a suspended or archived tenant.": "publishErrorSuspended",
  "Generated-site activation requires verified tenant email sending.": "publishErrorEmail",
  "Activation requires client approval.": "publishErrorApproval",
  "Activation requires completed or waived payment through the payment abstraction.":
    "publishErrorPayment",
  "Activation requires an approved generation run or a manual activation override.":
    "publishErrorGenerationRun",
}

export function localizePageEditorSaveError(
  raw: string,
  t: (key: string) => string,
): string {
  const bare = raw.replace(/^(publish|page|theme|site-settings|commit|save):\s*/i, "").trim()
  const key = PUBLISH_GATE_ERROR_KEYS[bare]
  if (key) return t(key)
  return bare || raw
}
