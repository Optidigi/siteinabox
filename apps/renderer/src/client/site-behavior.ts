const carouselSelector = "[data-siab-service-carousel='true']"
const beforeAfterSelector = "[data-siab-before-after-pair='true']"

function toNumber(value: string | null, fallback: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readBoolean(value: string | null): boolean {
  return value === "true"
}

function enhanceServiceCarousel(section: HTMLElement) {
  const track = section.querySelector<HTMLElement>("[data-siab-service-track='true']")
  if (!track || track.dataset.siabEnhanced === "true") return

  const cards = Array.from(track.children).filter((child): child is HTMLElement => child instanceof HTMLElement)
  if (cards.length <= 1) return

  track.dataset.siabEnhanced = "true"
  track.tabIndex = 0
  track.setAttribute("aria-roledescription", "carousel")

  const paginationMode = track.dataset.pagination ?? "none"
  const pagination = section.querySelector<HTMLElement>(".cms-block__servicePagination")
  let currentIndex = 0
  let timer: number | undefined

  const setCurrent = (index: number, scroll = true) => {
    const nextIndex = Math.max(0, Math.min(cards.length - 1, index))
    currentIndex = nextIndex
    if (scroll) {
      cards[nextIndex]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" })
    }
    updatePagination()
  }

  const updateFromScroll = () => {
    const trackLeft = track.getBoundingClientRect().left
    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY
    cards.forEach((card, index) => {
      const distance = Math.abs(card.getBoundingClientRect().left - trackLeft)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    })
    currentIndex = nearestIndex
    updatePagination()
  }

  const updatePagination = () => {
    if (!pagination || paginationMode === "none") return
    if (paginationMode === "fraction") {
      pagination.textContent = `${currentIndex + 1} / ${cards.length}`
      return
    }
    pagination.querySelectorAll<HTMLButtonElement>("button").forEach((button, index) => {
      button.classList.toggle("is-active", index === currentIndex)
      button.setAttribute("aria-current", index === currentIndex ? "true" : "false")
    })
  }

  if (pagination && paginationMode !== "none") {
    pagination.removeAttribute("aria-hidden")
    if (paginationMode === "bullets") {
      pagination.replaceChildren(
        ...cards.map((_, index) => {
          const button = document.createElement("button")
          button.type = "button"
          button.className = index === 0 ? "is-active" : ""
          button.setAttribute("aria-label", `Go to slide ${index + 1}`)
          button.setAttribute("aria-current", index === 0 ? "true" : "false")
          button.addEventListener("click", () => setCurrent(index))
          return button
        }),
      )
    } else {
      pagination.textContent = `1 / ${cards.length}`
    }
  }

  const stopTimer = () => {
    if (timer !== undefined) window.clearInterval(timer)
    timer = undefined
  }

  const startTimer = () => {
    if (!readBoolean(section.dataset.autoplay ?? null) || timer !== undefined) return
    const delay = Math.max(500, toNumber(section.dataset.autoplayDelay ?? null, 5000))
    const loop = readBoolean(section.dataset.loop ?? null)
    timer = window.setInterval(() => {
      const nextIndex = currentIndex + 1
      if (nextIndex >= cards.length && !loop) {
        stopTimer()
        return
      }
      setCurrent(nextIndex >= cards.length ? 0 : nextIndex)
    }, delay)
  }

  track.addEventListener("scroll", () => window.requestAnimationFrame(updateFromScroll), { passive: true })
  track.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault()
      setCurrent(currentIndex + 1)
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      setCurrent(currentIndex - 1)
    }
  })

  if (readBoolean(section.dataset.pauseOnInteraction ?? null)) {
    track.addEventListener("pointerdown", stopTimer, { passive: true })
    track.addEventListener("focusin", stopTimer)
  }

  startTimer()
}

function enhanceBeforeAfter(pair: HTMLElement) {
  if (pair.dataset.siabEnhanced === "true") return
  const frame = pair.querySelector<HTMLElement>(".cms-block__comparisonFrame")
  if (!frame) return

  pair.dataset.siabEnhanced = "true"
  const orientation = pair.dataset.orientation === "vertical" ? "vertical" : "horizontal"
  let ratio = Math.max(5, Math.min(95, toNumber(pair.dataset.initialRatio ?? null, 50)))
  let dragging = false

  frame.tabIndex = 0
  frame.setAttribute("role", "slider")
  frame.setAttribute("aria-valuemin", "5")
  frame.setAttribute("aria-valuemax", "95")
  frame.setAttribute("aria-label", "Before and after image comparison")

  const setRatio = (nextRatio: number) => {
    ratio = Math.max(5, Math.min(95, nextRatio))
    pair.style.setProperty("--comparison-ratio", `${ratio}%`)
    frame.setAttribute("aria-valuenow", String(Math.round(ratio)))
  }

  const setRatioFromPointer = (event: PointerEvent) => {
    const rect = frame.getBoundingClientRect()
    const rawRatio =
      orientation === "vertical"
        ? ((event.clientY - rect.top) / rect.height) * 100
        : ((event.clientX - rect.left) / rect.width) * 100
    setRatio(rawRatio)
  }

  frame.addEventListener("pointerdown", (event) => {
    dragging = true
    frame.setPointerCapture(event.pointerId)
    setRatioFromPointer(event)
  })
  frame.addEventListener("pointermove", (event) => {
    if (dragging) setRatioFromPointer(event)
  })
  frame.addEventListener("pointerup", (event) => {
    dragging = false
    frame.releasePointerCapture(event.pointerId)
  })
  frame.addEventListener("pointercancel", () => {
    dragging = false
  })
  frame.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 10 : 5
    if (event.key === "Home") {
      event.preventDefault()
      setRatio(5)
    }
    if (event.key === "End") {
      event.preventDefault()
      setRatio(95)
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault()
      setRatio(ratio - step)
    }
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault()
      setRatio(ratio + step)
    }
  })

  setRatio(ratio)
}

function initRendererBehavior() {
  document.querySelectorAll<HTMLElement>(carouselSelector).forEach(enhanceServiceCarousel)
  document.querySelectorAll<HTMLElement>(beforeAfterSelector).forEach(enhanceBeforeAfter)
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initRendererBehavior, { once: true })
} else {
  initRendererBehavior()
}
