import type {
  PreviewCheckoutActionState,
} from "@/lib/checkout/previewCheckoutContract"

type VersionConflictDetails = Pick<PreviewCheckoutActionState, "quotes">
type ProfileConflictDetails = Pick<PreviewCheckoutActionState, "currentProfile">

export function checkoutVersionConflict(
  message: string,
  details: VersionConflictDetails = {},
): PreviewCheckoutActionState {
  return {
    ok: false,
    status: "version_conflict",
    message,
    ...details,
  }
}

export function checkoutProfileConflict(
  message: string,
  details: ProfileConflictDetails = {},
): PreviewCheckoutActionState {
  return {
    ok: false,
    status: "profile_conflict",
    message,
    ...details,
  }
}
