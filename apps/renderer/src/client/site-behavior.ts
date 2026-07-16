import "./analytics-runtime"
import {
  COLOR_MODE_STORAGE_KEY,
  normalizeColorMode,
  readStoredColorMode,
  resolveColorMode,
  SYSTEM_DARK_QUERY,
  writeStoredColorMode,
  type ThemePreference,
} from "@siteinabox/site-renderer/theme"

const root = document.documentElement
const systemColorMode = window.matchMedia(SYSTEM_DARK_QUERY)

function storage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function normalizeThemePreference(value: unknown): ThemePreference {
  return value === "dark" || value === "system" ? value : "light"
}

function applyColorMode() {
  const stored = readStoredColorMode(storage())
  const resolve = (preference: ThemePreference) => resolveColorMode(preference, stored, systemColorMode.matches)
  const pageMode = resolve(normalizeThemePreference(root.dataset.siabThemeMode))
  root.dataset.siabColorMode = pageMode
  root.dataset.rtMode = pageMode
  document.querySelectorAll<HTMLElement>("[data-siab-theme-mode]").forEach((canvas) => {
    canvas.dataset.rtMode = resolve(normalizeThemePreference(canvas.dataset.siabThemeMode))
  })
}

applyColorMode()
systemColorMode.addEventListener("change", applyColorMode)
window.addEventListener("storage", (event) => {
  if (event.key === null || event.key === COLOR_MODE_STORAGE_KEY) applyColorMode()
})

const managedFormSelector = "form[data-siab-analytics-form='true']"

type ConsentConfig = { consentStorageKey?: string; consentVersion?: string }

function readConsentConfig(): ConsentConfig {
  const node = document.querySelector<HTMLScriptElement>("#siab-analytics-config")
  if (!node?.textContent) return {}
  try {
    return JSON.parse(node.textContent) as ConsentConfig
  } catch {
    return {}
  }
}

function hasCurrentConsent(config: ConsentConfig) {
  if (!config.consentStorageKey) return false
  try {
    const stored = window.localStorage.getItem(config.consentStorageKey)
    if (!stored) return false
    const receipt = JSON.parse(stored) as { version?: unknown; categories?: { analytics?: unknown } }
    return String(receipt.version ?? "") === String(config.consentVersion ?? "1") && typeof receipt.categories?.analytics === "boolean"
  } catch {
    return false
  }
}

const consentBanner = document.querySelector<HTMLElement>("[data-siab-cookie-consent='true']")
const consentConfig = readConsentConfig()
if (consentBanner && hasCurrentConsent(consentConfig)) consentBanner.hidden = true

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null
  const navigationToggle = target?.closest<HTMLButtonElement>("[data-navbar-toggle]")
  if (navigationToggle) {
    const root = navigationToggle.closest<HTMLElement>("[data-provider-mobile-navigation]")
    const panel = root?.querySelector<HTMLElement>("[data-navbar-panel]")
    const expanded = navigationToggle.getAttribute("aria-expanded") !== "true"
    navigationToggle.setAttribute("aria-expanded", String(expanded))
    panel?.classList.toggle("hidden", !expanded)
    root?.querySelector<HTMLElement>("[data-navbar-open-icon]")?.classList.toggle("hidden", expanded)
    root?.querySelector<HTMLElement>("[data-navbar-close-icon]")?.classList.toggle("hidden", !expanded)
    return
  }

  const themeToggle = target?.closest<HTMLButtonElement>("[data-theme-toggle]")
  if (themeToggle) {
    const current = normalizeColorMode(root.dataset.siabColorMode) ?? "light"
    writeStoredColorMode(storage(), current === "dark" ? "light" : "dark")
    applyColorMode()
    return
  }

  const dismiss = target?.closest<HTMLButtonElement>("[data-banner-dismiss]")
  if (dismiss) {
    const banner = dismiss.closest<HTMLElement>("[data-provider-variant^='shadcnui-blocks.banner-']")
    if (banner) banner.hidden = true
    return
  }

  const button = target?.closest<HTMLButtonElement>("[data-siab-cookie-consent='true'] [data-consent-action]")
  if (!button) return
  const accepted = button.dataset.consentAction === "accept"
  const banner = button.closest<HTMLElement>("[data-siab-cookie-consent='true']")
  const storageKey = consentConfig.consentStorageKey || "siab_cookie_consent_v1"
  const receipt = { version: consentConfig.consentVersion || "1", categories: { necessary: true, analytics: accepted } }
  window.localStorage.setItem(storageKey, JSON.stringify(receipt))
  if (accepted) window.SIABAnalytics?.grantConsent()
  else window.SIABAnalytics?.revokeConsent()
  if (banner) banner.hidden = true
})

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return
  document.querySelectorAll<HTMLElement>("[data-provider-mobile-navigation]").forEach((root) => {
    root.querySelector<HTMLElement>("[data-navbar-panel]")?.classList.add("hidden")
    const toggle = root.querySelector<HTMLButtonElement>("[data-navbar-toggle]")
    toggle?.setAttribute("aria-expanded", "false")
    root.querySelector<HTMLElement>("[data-navbar-open-icon]")?.classList.remove("hidden")
    root.querySelector<HTMLElement>("[data-navbar-close-icon]")?.classList.add("hidden")
  })
})

function findMessage(form: HTMLFormElement) {
  return form.querySelector<HTMLElement>(".cms-block__form-message")
}

function setFormMessage(form: HTMLFormElement, state: "success" | "error", fallback: string) {
  const message = findMessage(form)
  if (!message) return
  const text =
    state === "success"
      ? message.dataset.successMessage || fallback
      : message.dataset.errorMessage || fallback
  message.textContent = text
  message.dataset.state = state
  message.hidden = false
}

function isManagedPostForm(form: HTMLFormElement) {
  const method = (form.getAttribute("method") || "GET").toUpperCase()
  const action = form.getAttribute("action") || ""
  if (method !== "POST") return false
  if (!action || action.startsWith("mailto:")) return false
  return action === "/api/forms" || action.startsWith("/api/forms?") || action.startsWith("/api/forms/")
}

document.addEventListener("submit", async (event) => {
  const form = event.target instanceof Element
    ? event.target.closest<HTMLFormElement>(managedFormSelector)
    : null
  if (!form || !isManagedPostForm(form)) return
  event.preventDefault()

  const submitButton = form.querySelector<HTMLButtonElement>("button[type='submit'], input[type='submit']")
  const originalText = submitButton?.textContent ?? null
  if (submitButton) {
    submitButton.disabled = true
    if (submitButton.tagName === "BUTTON") submitButton.textContent = "Sending..."
  }

  try {
    const response = await fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" },
    })
    if (!response.ok) throw new Error("form_submit_failed")
    form.reset()
    setFormMessage(form, "success", "Thanks. Your message has been sent.")
  } catch {
    setFormMessage(form, "error", "The message could not be sent. Please try again.")
  } finally {
    if (submitButton) {
      submitButton.disabled = false
      if (originalText !== null && submitButton.tagName === "BUTTON") submitButton.textContent = originalText
    }
  }
})
