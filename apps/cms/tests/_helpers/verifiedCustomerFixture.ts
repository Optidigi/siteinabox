/** Unit consumer boundary only; SDK/PostgreSQL/browser tests prove authority. */
export function verifiedCustomerFixture(email = "customer@example.com", previewUserId = "preview-customer") {
  const normalized = email.trim().toLowerCase()
  return {
    account: { id: 1, email: normalized, previewUserId, verifiedAt: "2026-01-01T00:00:00.000Z" },
    authority: { accountId: 1, previewSessionId: "preview-session" },
    payload: {},
  }
}
