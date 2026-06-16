import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * True on touch / coarse-pointer devices (phones, tablets). Used to suppress
 * input autofocus on open — autofocus pops the on-screen keyboard, which
 * covers modals and sheets and blocks them from positioning. SSR-safe
 * (returns false on the server).
 */
export function isCoarsePointer(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  )
}
