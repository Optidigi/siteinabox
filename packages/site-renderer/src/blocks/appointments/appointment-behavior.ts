import { AppointmentAvailabilityResponseSchema, type AppointmentAvailabilityResponse, type AppointmentSlot } from "@siteinabox/contracts"

const APPOINTMENT_SELECTOR = "[data-siab-appointment-block]"
const DAY_MS = 86_400_000

type AppointmentLocale = "nl-NL" | "en-US"

type AppointmentLabels = {
  loading: string
  unavailable: string
  noAvailability: string
  chooseDay: string
  chooseTime: string
  chooseMoment: string
  selected: string
  detailsLabel: string
  detailsTitle: string
  name: string
  email: string
  phone: string
  optional: string
  note: string
  continue: string
  confirmationHeading: string
  confirmationBody: string
  submit: string
  back: string
  close: string
  previousMonth: string
  nextMonth: string
  localTime: string
  previewTime: string
  noScript: string
  requestFailed: string
}

const labelsFor = (locale: AppointmentLocale): AppointmentLabels => locale === "nl-NL"
  ? {
      loading: "Beschikbare momenten laden…",
      unavailable: "De beschikbaarheid kon niet worden geladen. Probeer het later opnieuw.",
      noAvailability: "Op dit moment zijn er geen momenten beschikbaar.",
      chooseDay: "Kies een beschikbare dag om tijden te zien.",
      chooseTime: "Kies een tijd om verder te gaan.",
      chooseMoment: "Kies een moment",
      selected: "Gekozen moment",
      detailsLabel: "Jouw gegevens",
      detailsTitle: "Bijna geregeld",
      name: "Naam",
      email: "E-mailadres",
      phone: "Telefoonnummer",
      optional: "optioneel",
      note: "Waar wil je het over hebben?",
      continue: "Verder",
      confirmationHeading: "Afspraak bevestigd",
      confirmationBody: "Je ontvangt zo een bevestiging met de details van je afspraak.",
      submit: "Afspraak aanvragen",
      back: "Terug",
      close: "Sluiten",
      previousMonth: "Vorige maand",
      nextMonth: "Volgende maand",
      localTime: "Lokale tijd",
      previewTime: "Voorbeeldbeschikbaarheid",
      noScript: "De afspraakplanner heeft JavaScript nodig. Neem rechtstreeks contact op om een moment af te spreken.",
      requestFailed: "De afspraak kon niet worden aangevraagd. Kies een ander moment of probeer het later opnieuw.",
    }
  : {
      loading: "Loading available times…",
      unavailable: "Availability could not be loaded. Please try again later.",
      noAvailability: "There are no available times right now.",
      chooseDay: "Choose an available day to see times.",
      chooseTime: "Choose a time to continue.",
      chooseMoment: "Choose a time",
      selected: "Selected time",
      detailsLabel: "Your details",
      detailsTitle: "Almost there",
      name: "Name",
      email: "Email address",
      phone: "Phone number",
      optional: "optional",
      note: "What would you like to discuss?",
      continue: "Continue",
      confirmationHeading: "Appointment confirmed",
      confirmationBody: "You will receive a confirmation with the appointment details shortly.",
      submit: "Request appointment",
      back: "Back",
      close: "Close",
      previousMonth: "Previous month",
      nextMonth: "Next month",
      localTime: "Local time",
      previewTime: "Preview availability",
      noScript: "The appointment planner needs JavaScript. Contact us directly to arrange a time.",
      requestFailed: "The appointment could not be requested. Choose another time or try again later.",
    }

const pad = (value: number): string => String(value).padStart(2, "0")

export const appointmentDateKey = (year: number, month: number, day: number): string =>
  `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`

export const addDaysToDateKey = (value: string, days: number): string => {
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1))
  date.setUTCDate(date.getUTCDate() + days)
  return appointmentDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

const dateKeyFromUtcDate = (date: Date): string =>
  appointmentDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())

const dateAtUtc = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1))
}

const isWeekday = (value: string): boolean => {
  const weekday = dateAtUtc(value).getUTCDay()
  return weekday !== 0 && weekday !== 6
}

/** Deterministic availability used only by the CMS preview frame. */
export const previewAppointmentAvailability = (
  from: string,
  to: string,
): AppointmentAvailabilityResponse => {
  const slots: AppointmentSlot[] = []
  for (let cursor = from; cursor <= to; cursor = addDaysToDateKey(cursor, 1)) {
    if (!isWeekday(cursor)) continue
    for (const [hour, minute] of [[9, 0], [11, 30], [14, 0]] as const) {
      const startAt = `${cursor}T${pad(hour)}:${pad(minute)}:00.000Z`
      const endDate = new Date(Date.parse(startAt) + 30 * 60_000)
      slots.push({ startAt, endAt: endDate.toISOString(), timezone: "Europe/Amsterdam" })
    }
  }
  return { timezone: "Europe/Amsterdam", from, to, slots }
}

const parseAvailability = (value: unknown): AppointmentAvailabilityResponse | null => {
  const parsed = AppointmentAvailabilityResponseSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

const localeFromDocument = (ownerDocument: Document): AppointmentLocale =>
  ownerDocument.documentElement.lang.toLowerCase().startsWith("nl") ? "nl-NL" : "en-US"

const dateKeyInTimeZone = (date: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return appointmentDateKey(Number(values.year), Number(values.month), Number(values.day))
}

const todayDateKey = (timeZone: string): string => dateKeyInTimeZone(new Date(), timeZone)

const monthStart = (value: Date): Date => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1))

const monthEndDateKey = (value: Date): string => {
  const end = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0))
  return dateKeyFromUtcDate(end)
}

const formatMonth = (value: Date, locale: AppointmentLocale): string => new Intl.DateTimeFormat(locale, {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
}).format(value)

const formatDayLabel = (value: string, locale: AppointmentLocale, timeZone: string): string => new Intl.DateTimeFormat(locale, {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone,
}).format(new Date(`${value}T12:00:00.000Z`))

const formatTime = (value: string, locale: AppointmentLocale, timeZone: string): string => new Intl.DateTimeFormat(locale, {
  hour: "2-digit",
  minute: "2-digit",
  timeZone,
}).format(new Date(value))

const text = (element: Element | null | undefined, value: string): void => {
  if (element) element.textContent = value
}

const setHidden = (element: HTMLElement | null, hidden: boolean): void => {
  if (element) element.hidden = hidden
}

const setDisabled = (element: HTMLButtonElement | null, disabled: boolean): void => {
  if (element) element.disabled = disabled
}

const formValue = (form: HTMLFormElement, name: string): string => {
  const field = form.elements.namedItem(name)
  return field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement ? field.value.trim() : ""
}

type AppointmentController = {
  open: (trigger?: HTMLElement | null) => void
  matchesTrigger: (value: string) => boolean
  destroy: () => void
}

function initializeAppointmentBlock(block: HTMLElement): AppointmentController {
  const ownerDocument = block.ownerDocument
  const locale = localeFromDocument(ownerDocument)
  const labels = labelsFor(locale)
  const dialog = block.querySelector<HTMLDialogElement>("[data-siab-appointment-dialog]")
  const flow = block.querySelector<HTMLElement>("[data-siab-appointment-flow]")
  const calendarStep = flow?.querySelector<HTMLElement>("[data-siab-appointment-calendar-step]") ?? null
  const detailsForm = flow?.querySelector<HTMLFormElement>("[data-siab-appointment-details]") ?? null
  const confirmation = flow?.querySelector<HTMLElement>("[data-siab-appointment-confirmation]") ?? null
  const calendarGrid = flow?.querySelector<HTMLElement>("[data-siab-appointment-calendar-grid]") ?? null
  const weekdays = flow?.querySelector<HTMLElement>("[data-siab-appointment-weekdays]") ?? null
  const slotsContainer = flow?.querySelector<HTMLElement>("[data-siab-appointment-slots]") ?? null
  const status = flow?.querySelector<HTMLElement>("[data-siab-appointment-status]") ?? null
  const monthLabel = flow?.querySelector<HTMLElement>("[data-siab-appointment-month]") ?? null
  const timezoneLabel = flow?.querySelector<HTMLElement>("[data-siab-appointment-timezone]") ?? null
  const stepTitle = flow?.querySelector<HTMLElement>("[data-siab-appointment-step-title]") ?? null
  const selectedSlotLabel = flow?.querySelector<HTMLElement>("[data-siab-appointment-selected-slot]") ?? null
  const continueButton = flow?.querySelector<HTMLButtonElement>("[data-siab-appointment-continue]") ?? null
  const availabilityMode = block.dataset.siabAppointmentRuntime === "preview" ? "preview" : "public"
  const anchor = block.dataset.siabAppointmentAnchor?.trim()
  const state = {
    month: monthStart(new Date()),
    selectedDate: null as string | null,
    selectedSlot: null as AppointmentSlot | null,
    timezone: "Europe/Amsterdam",
    slotsByDate: new Map<string, AppointmentSlot[]>(),
    loadId: 0,
    lastTrigger: null as HTMLElement | null,
  }
  const cleanups: Array<() => void> = []
  let destroyed = false
  let availabilityAbortController: AbortController | null = null
  let bookingAbortController: AbortController | null = null

  const setStatus = (message: string, stateName?: "error"): void => {
    text(status, message)
    if (status) {
      if (stateName) status.dataset.state = stateName
      else delete status.dataset.state
    }
  }

  const renderWeekdays = (): void => {
    if (!weekdays) return
    weekdays.replaceChildren()
    const baseDate = new Date(Date.UTC(2024, 0, 1))
    const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" })
    for (let index = 0; index < 7; index += 1) {
      const day = new Date(baseDate.getTime() + index * DAY_MS)
      const item = ownerDocument.createElement("span")
      item.textContent = weekdayFormatter.format(day).replace(".", "")
      item.setAttribute("aria-hidden", "true")
      weekdays.append(item)
    }
  }

  const renderSlots = (): void => {
    if (!slotsContainer) return
    slotsContainer.replaceChildren()
    if (!state.selectedDate) {
      const empty = ownerDocument.createElement("p")
      empty.className = "site-appointment-empty"
      empty.textContent = labels.chooseDay
      slotsContainer.append(empty)
      setDisabled(continueButton, true)
      return
    }
    const slots = state.slotsByDate.get(state.selectedDate) ?? []
    if (slots.length === 0) {
      const empty = ownerDocument.createElement("p")
      empty.className = "site-appointment-empty"
      empty.textContent = labels.noAvailability
      slotsContainer.append(empty)
      setDisabled(continueButton, true)
      return
    }

    const heading = ownerDocument.createElement("p")
    heading.className = "site-appointment-slots-heading"
    heading.textContent = formatDayLabel(state.selectedDate, locale, state.timezone)
    slotsContainer.append(heading)

    const list = ownerDocument.createElement("div")
    list.className = "site-appointment-slot-list"
    for (const slot of slots) {
      const button = ownerDocument.createElement("button")
      button.type = "button"
      button.className = "site-appointment-slot"
      button.dataset.siabAppointmentSlot = slot.startAt
      button.textContent = formatTime(slot.startAt, locale, state.timezone)
      button.setAttribute("aria-pressed", state.selectedSlot?.startAt === slot.startAt ? "true" : "false")
      if (state.selectedSlot?.startAt === slot.startAt) button.classList.add("is-selected")
      list.append(button)
    }
    slotsContainer.append(list)
    setDisabled(continueButton, !state.selectedSlot)
  }

  const renderCalendar = (): void => {
    if (!calendarGrid) return
    const first = monthStart(state.month)
    text(monthLabel, formatMonth(first, locale))
    const firstWeekday = (first.getUTCDay() + 6) % 7
    const start = new Date(first.getTime() - firstWeekday * DAY_MS)
    const minimumDate = todayDateKey(state.timezone)
    calendarGrid.replaceChildren()
    for (let index = 0; index < 42; index += 1) {
      const date = new Date(start.getTime() + index * DAY_MS)
      const dateKey = dateKeyFromUtcDate(date)
      const inMonth = date.getUTCMonth() === first.getUTCMonth()
      const available = (state.slotsByDate.get(dateKey)?.length ?? 0) > 0
      const dayButton = ownerDocument.createElement("button")
      dayButton.type = "button"
      dayButton.className = "site-appointment-day"
      dayButton.dataset.siabAppointmentDate = dateKey
      dayButton.textContent = String(date.getUTCDate())
      dayButton.setAttribute("aria-label", formatDayLabel(dateKey, locale, state.timezone))
      dayButton.setAttribute("aria-pressed", state.selectedDate === dateKey ? "true" : "false")
      dayButton.disabled = !inMonth || dateKey < minimumDate || !available
      if (!inMonth) dayButton.classList.add("is-outside-month")
      if (available && inMonth && dateKey >= minimumDate) dayButton.classList.add("is-available")
      if (state.selectedDate === dateKey) dayButton.classList.add("is-selected")
      calendarGrid.append(dayButton)
    }
    const previousButton = flow?.querySelector<HTMLButtonElement>("[data-siab-appointment-prev-month]") ?? null
    const nextButton = flow?.querySelector<HTMLButtonElement>("[data-siab-appointment-next-month]") ?? null
    setDisabled(previousButton, first.getTime() <= monthStart(new Date()).getTime())
    const maxMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 11, 1))
    setDisabled(nextButton, first.getTime() >= maxMonth.getTime())
  }

  const getAvailability = async (from: string, to: string): Promise<AppointmentAvailabilityResponse> => {
    if (availabilityMode === "preview") return previewAppointmentAvailability(from, to)
    availabilityAbortController?.abort()
    const controller = new AbortController()
    availabilityAbortController = controller
    const endpoint = new URL("/api/appointments/availability", ownerDocument.defaultView?.location.origin ?? window.location.origin)
    endpoint.searchParams.set("from", from)
    endpoint.searchParams.set("to", to)
    try {
      const response = await fetch(endpoint, { method: "GET", headers: { Accept: "application/json" }, credentials: "same-origin", cache: "no-store", signal: controller.signal })
      const body: unknown = await response.json().catch(() => null)
      const parsed = parseAvailability(body)
      if (!response.ok || !parsed) throw new Error("availability_unavailable")
      return parsed
    } finally {
      if (availabilityAbortController === controller) availabilityAbortController = null
    }
  }

  const loadMonth = async (): Promise<void> => {
    const currentLoad = state.loadId + 1
    state.loadId = currentLoad
    state.selectedDate = null
    state.selectedSlot = null
    state.slotsByDate = new Map()
    renderCalendar()
    renderSlots()
    setStatus(labels.loading)
    const from = dateKeyFromUtcDate(monthStart(state.month))
    const to = monthEndDateKey(state.month)
    try {
      const availability = await getAvailability(from, to)
      if (destroyed || currentLoad !== state.loadId) return
      state.timezone = availability.timezone
      state.slotsByDate = new Map()
      for (const slot of availability.slots) {
        const date = dateKeyInTimeZone(new Date(slot.startAt), availability.timezone)
        const existing = state.slotsByDate.get(date) ?? []
        existing.push(slot)
        state.slotsByDate.set(date, existing)
      }
      text(timezoneLabel, `${availabilityMode === "preview" ? labels.previewTime : labels.localTime} · ${availability.timezone}`)
      renderCalendar()
      renderSlots()
      setStatus(availability.slots.length > 0 ? "" : labels.noAvailability)
    } catch {
      if (destroyed || currentLoad !== state.loadId) return
      renderCalendar()
      renderSlots()
      setStatus(labels.unavailable, "error")
    }
  }

  const resetFlow = (): void => {
    if (destroyed) return
    state.month = monthStart(new Date())
    state.selectedDate = null
    state.selectedSlot = null
    state.slotsByDate = new Map()
    if (detailsForm) detailsForm.reset()
    setHidden(calendarStep, false)
    setHidden(detailsForm, true)
    setHidden(confirmation, true)
    text(stepTitle, labels.chooseMoment)
    text(selectedSlotLabel, "")
    renderCalendar()
    renderSlots()
    void loadMonth()
  }

  const close = (): void => {
    if (destroyed) return
    if (dialog) {
      if (dialog.open && typeof dialog.close === "function") dialog.close()
      else dialog.removeAttribute("open")
    }
    state.lastTrigger?.focus()
    state.lastTrigger = null
  }

  const open = (trigger?: HTMLElement | null): void => {
    if (destroyed) return
    state.lastTrigger = trigger ?? null
    resetFlow()
    if (!dialog) {
      block.scrollIntoView({ behavior: "smooth", block: "start" })
      window.requestAnimationFrame(() => detailsForm?.querySelector<HTMLElement>("input")?.focus())
      return
    }
    if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal()
    else dialog.setAttribute("open", "")
    window.requestAnimationFrame(() => flow?.querySelector<HTMLElement>("[data-siab-appointment-prev-month], [data-siab-appointment-date]")?.focus())
  }

  const onClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target : null
    const openButton = target?.closest<HTMLElement>("[data-siab-appointment-open]")
    if (openButton) {
      event.preventDefault()
      open(openButton)
      return
    }
    const closeButton = target?.closest<HTMLElement>("[data-siab-appointment-close], [data-siab-appointment-close-flow]")
    if (closeButton) {
      event.preventDefault()
      close()
      return
    }
    const previousButton = target?.closest<HTMLButtonElement>("[data-siab-appointment-prev-month]")
    if (previousButton && !previousButton.disabled) {
      state.month = new Date(Date.UTC(state.month.getUTCFullYear(), state.month.getUTCMonth() - 1, 1))
      void loadMonth()
      return
    }
    const nextButton = target?.closest<HTMLButtonElement>("[data-siab-appointment-next-month]")
    if (nextButton && !nextButton.disabled) {
      state.month = new Date(Date.UTC(state.month.getUTCFullYear(), state.month.getUTCMonth() + 1, 1))
      void loadMonth()
      return
    }
    const dayButton = target?.closest<HTMLButtonElement>("[data-siab-appointment-date]")
    if (dayButton && !dayButton.disabled) {
      state.selectedDate = dayButton.dataset.siabAppointmentDate ?? null
      state.selectedSlot = null
      renderCalendar()
      renderSlots()
      setStatus(labels.chooseTime)
      return
    }
    const slotButton = target?.closest<HTMLButtonElement>("[data-siab-appointment-slot]")
    if (slotButton) {
      const selected = (state.slotsByDate.get(state.selectedDate ?? "") ?? []).find((slot) => slot.startAt === slotButton.dataset.siabAppointmentSlot)
      if (selected) {
        state.selectedSlot = selected
        renderSlots()
        setStatus("")
      }
      return
    }
    if (target === dialog) close()
  }

  const onContinue = (): void => {
    if (!state.selectedDate || !state.selectedSlot) {
      setStatus(labels.chooseTime)
      return
    }
    setHidden(calendarStep, true)
    setHidden(detailsForm, false)
    setHidden(confirmation, true)
    text(stepTitle, labels.detailsTitle)
    text(selectedSlotLabel, `${labels.selected}: ${formatDayLabel(state.selectedDate, locale, state.timezone)} · ${formatTime(state.selectedSlot.startAt, locale, state.timezone)}`)
    detailsForm?.querySelector<HTMLElement>("input")?.focus()
  }

  const onBack = (): void => {
    setHidden(calendarStep, false)
    setHidden(detailsForm, true)
    setHidden(confirmation, true)
    text(stepTitle, labels.chooseMoment)
    setStatus("")
  }

  const onSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault()
    if (!detailsForm || !state.selectedSlot) return
    if (!detailsForm.reportValidity()) return
    const submitButton = detailsForm.querySelector<HTMLButtonElement>("button[type='submit']")
    setDisabled(submitButton, true)
    setStatus(labels.loading)
    const payload = {
      startAt: state.selectedSlot.startAt,
      visitorName: formValue(detailsForm, "visitorName"),
      visitorEmail: formValue(detailsForm, "visitorEmail"),
      ...(formValue(detailsForm, "visitorPhone") ? { visitorPhone: formValue(detailsForm, "visitorPhone") } : {}),
      ...(formValue(detailsForm, "visitorNote") ? { visitorNote: formValue(detailsForm, "visitorNote") } : {}),
      pageUrl: ownerDocument.defaultView?.location.href ?? "",
    }
    try {
      if (availabilityMode === "preview") {
        await Promise.resolve()
      } else {
        bookingAbortController?.abort()
        const controller = new AbortController()
        bookingAbortController = controller
        const response = await fetch("/api/appointments", {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          credentials: "same-origin",
          signal: controller.signal,
          body: JSON.stringify(payload),
        })
        if (!response.ok) throw new Error("booking_failed")
      }
      if (destroyed) return
      setHidden(calendarStep, true)
      setHidden(detailsForm, true)
      setHidden(confirmation, false)
      text(stepTitle, labels.confirmationHeading)
      text(flow?.querySelector<HTMLElement>("[data-siab-appointment-confirmation-heading]"), block.dataset.siabAppointmentConfirmationHeading ?? labels.confirmationHeading)
      const confirmationBody = flow?.querySelector<HTMLElement>("[data-siab-appointment-confirmation-body]")
      if (confirmationBody) confirmationBody.textContent = block.dataset.siabAppointmentConfirmationBody || labels.confirmationBody
      setStatus("")
    } catch {
      if (!destroyed) setStatus(labels.requestFailed, "error")
    } finally {
      bookingAbortController = null
      if (!destroyed) setDisabled(submitButton, false)
    }
  }

  renderWeekdays()
  if (flow) {
    flow.querySelectorAll<HTMLButtonElement>("[data-siab-appointment-prev-month], [data-siab-appointment-next-month]").forEach((button) => {
      button.setAttribute("aria-label", button.hasAttribute("data-siab-appointment-prev-month") ? labels.previousMonth : labels.nextMonth)
    })
    flow.querySelectorAll<HTMLElement>("[data-siab-appointment-back]").forEach((button) => { button.textContent = labels.back })
    flow.querySelectorAll<HTMLElement>("[data-siab-appointment-continue]").forEach((button) => { button.textContent = labels.continue })
    flow.querySelectorAll<HTMLButtonElement>("button[type='submit']").forEach((button) => { button.textContent = block.dataset.siabAppointmentBookingLabel ?? labels.submit })
    flow.querySelectorAll<HTMLElement>("[data-siab-appointment-close-flow]").forEach((button) => { button.textContent = labels.close })
    flow.querySelectorAll<HTMLElement>("[data-siab-appointment-details-label]").forEach((element) => { element.textContent = labels.detailsLabel })
    flow.querySelectorAll<HTMLElement>("[data-siab-appointment-details-title]").forEach((element) => { element.textContent = labels.detailsTitle })
    flow.querySelectorAll<HTMLElement>("[data-siab-appointment-field-label='name']").forEach((element) => { element.textContent = labels.name })
    flow.querySelectorAll<HTMLElement>("[data-siab-appointment-field-label='email']").forEach((element) => { element.textContent = labels.email })
    flow.querySelectorAll<HTMLElement>("[data-siab-appointment-field-label='phone']").forEach((element) => { element.textContent = labels.phone })
    flow.querySelectorAll<HTMLElement>("[data-siab-appointment-field-label='note']").forEach((element) => { element.textContent = labels.note })
    flow.querySelectorAll<HTMLElement>("[data-siab-appointment-optional]").forEach((element) => { element.textContent = `(${labels.optional})` })
  }
  block.querySelectorAll<HTMLButtonElement>("[data-siab-appointment-dialog-close]").forEach((button) => { button.setAttribute("aria-label", labels.close) })
  block.querySelectorAll<HTMLElement>("[data-siab-appointment-no-script]").forEach((element) => { element.textContent = labels.noScript })
  renderCalendar()
  renderSlots()
  if (block.dataset.siabAppointmentPresentation === "inline") void loadMonth()

  block.addEventListener("click", onClick)
  cleanups.push(() => block.removeEventListener("click", onClick))
  continueButton?.addEventListener("click", onContinue)
  if (continueButton) cleanups.push(() => continueButton.removeEventListener("click", onContinue))
  flow?.querySelectorAll<HTMLElement>("[data-siab-appointment-back]").forEach((button) => {
    button.addEventListener("click", onBack)
    cleanups.push(() => button.removeEventListener("click", onBack))
  })
  detailsForm?.addEventListener("submit", onSubmit)
  if (detailsForm) cleanups.push(() => detailsForm.removeEventListener("submit", onSubmit))
  const onDialogClose = (): void => {
    state.lastTrigger?.focus()
    state.lastTrigger = null
  }
  dialog?.addEventListener("close", onDialogClose)
  if (dialog) cleanups.push(() => dialog.removeEventListener("close", onDialogClose))

  return {
    open,
    matchesTrigger: (value: string) => Boolean(anchor && (value === anchor || value === `#${anchor}`)),
    destroy: () => {
      if (destroyed) return
      destroyed = true
      state.loadId += 1
      availabilityAbortController?.abort()
      bookingAbortController?.abort()
      availabilityAbortController = null
      bookingAbortController = null
      cleanups.forEach((cleanup) => cleanup())
    },
  }
}

export function initializeAppointmentBlocks(root: ParentNode = document): () => void {
  const blocks: HTMLElement[] = root instanceof HTMLElement && root.matches(APPOINTMENT_SELECTOR)
    ? [root, ...Array.from(root.querySelectorAll<HTMLElement>(APPOINTMENT_SELECTOR))]
    : Array.from(root.querySelectorAll<HTMLElement>(APPOINTMENT_SELECTOR))
  const controllers = blocks.map(initializeAppointmentBlock)
  const ownerDocument = root instanceof Document ? root : root.ownerDocument ?? document
  const onTriggerClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-siab-appointment-trigger], a[href]") : null
    if (!target) return
    const explicit = target.dataset.siabAppointmentTrigger
    const href = target.getAttribute("href")
    const hash = explicit ?? (href?.startsWith("#") ? href : null)
    if (!hash) return
    const controller = controllers.find((candidate) => candidate.matchesTrigger(hash))
    if (!controller) return
    event.preventDefault()
    controller.open(target)
  }
  ownerDocument.addEventListener("click", onTriggerClick)
  return () => {
    ownerDocument.removeEventListener("click", onTriggerClick)
    controllers.forEach((controller) => controller.destroy())
  }
}
