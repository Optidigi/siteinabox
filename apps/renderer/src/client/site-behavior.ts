import "./analytics-runtime"

const managedFormSelector = "form[data-siab-analytics-form='true']"

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
  const form = (event.target as Element | null)?.closest(managedFormSelector) as HTMLFormElement | null
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
