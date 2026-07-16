import type { ThemeTokenSpec } from "@siteinabox/contracts"

export type ThemePreference = "light" | "dark" | "system"
export type ResolvedColorMode = "light" | "dark"

export const COLOR_MODE_STORAGE_KEY = "siab-color-mode"
export const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)"

export const themePreference = (theme: ThemeTokenSpec | null | undefined): ThemePreference =>
  theme?.appearance?.mode ?? "light"

export const normalizeColorMode = (value: unknown): ResolvedColorMode | null =>
  value === "light" || value === "dark" ? value : null

export function resolveColorMode(
  preference: ThemePreference,
  storedOverride: unknown,
  systemPrefersDark: boolean,
): ResolvedColorMode {
  return normalizeColorMode(storedOverride)
    ?? (preference === "system" ? (systemPrefersDark ? "dark" : "light") : preference)
}

export function readStoredColorMode(storage: Pick<Storage, "getItem"> | null | undefined): ResolvedColorMode | null {
  try {
    return normalizeColorMode(storage?.getItem(COLOR_MODE_STORAGE_KEY))
  } catch {
    return null
  }
}

export function writeStoredColorMode(storage: Pick<Storage, "setItem"> | null | undefined, mode: ResolvedColorMode): boolean {
  try {
    storage?.setItem(COLOR_MODE_STORAGE_KEY, mode)
    return Boolean(storage)
  } catch {
    return false
  }
}

// Runs in the document head before CSS can paint. Keep this dependency-free:
// Astro renders it verbatim with `is:inline` and CSP can authorize the script
// normally when the public renderer gains a nonce-bearing policy.
export const COLOR_MODE_BOOTSTRAP_SCRIPT = `(()=>{const d=document.documentElement,p=d.dataset.siabThemeMode||"light";let s=null;try{s=localStorage.getItem("${COLOR_MODE_STORAGE_KEY}")}catch{}const m=s==="light"||s==="dark"?s:p==="system"&&matchMedia("${SYSTEM_DARK_QUERY}").matches?"dark":p==="dark"?"dark":"light";d.dataset.siabColorMode=m;d.dataset.rtMode=m})()`
