/** next-intl treats `.` in message keys as nesting, so sentence keys must be encoded. */
export const encodeWorkflowTextKey = (value: string): string => value.replaceAll(".", "\uFF0E")

export const sanitizeWorkflowTextMessages = (
  workflowText: Record<string, string>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(workflowText).map(([key, message]) => [encodeWorkflowTextKey(key), message]),
  )
