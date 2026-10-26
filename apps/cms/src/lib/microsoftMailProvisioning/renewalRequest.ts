import type { MicrosoftMailProvisioningRequest } from "./model.ts"

export function mailRenewalRequest(previous: MicrosoftMailProvisioningRequest, mailboxes: unknown, quantity: number): MicrosoftMailProvisioningRequest {
  if (!Array.isArray(mailboxes) || mailboxes.length !== quantity || quantity < 1) throw new Error("The current mailbox snapshot requires review.")
  const users = mailboxes.map(value => {
    if (!value || typeof value !== "object" || !("address" in value) || typeof value.address !== "string" || !value.address.endsWith(`@${previous.domain}`)) throw new Error("The mailbox snapshot does not match the email domain.")
    return { localPart: value.address.split("@")[0] ?? "", userPrincipalName: value.address,
      displayName: "displayName" in value && typeof value.displayName === "string" ? value.displayName : value.address, setupEmail: "" }
  })
  return { ...previous, quantity, mailboxUsers: users, retainInfoForward: false, infoForwardTo: null, infoAliasTarget: null }
}
