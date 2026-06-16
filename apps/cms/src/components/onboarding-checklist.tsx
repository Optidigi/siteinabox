"use client"
import { useEffect, useState } from "react"
import { Card, CardContent } from "@siteinabox/ui/components/card"
import { Button } from "@siteinabox/ui/components/button"
import { Check, Copy } from "lucide-react"

export type OnboardingStep = {
  id: string
  title: string
  description: React.ReactNode
  copy?: string
}

export type OnboardingChecklistProps = {
  storageKey: string
  steps: OnboardingStep[]
  seed?: Record<string, boolean>
  onCopied?: () => void
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.left = "-9999px"
  textarea.style.top = "0"
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand("copy")
  textarea.remove()
}

export function OnboardingChecklist({ storageKey, steps, seed = {}, onCopied }: OnboardingChecklistProps) {
  // Initial state must match SSR — localStorage is unavailable until mount.
  // The useEffect below merges in the persisted state immediately after.
  const [done, setDone] = useState<Record<string, boolean>>(seed)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === "object") {
        // seed entries are non-overridable — they're true by virtue of
        // upstream state existing. Persisted values fill the rest.
        setDone({ ...seed, ...parsed })
      }
    } catch {
      // Quota / corrupt JSON — ignore; keep the seed.
    }
  }, [storageKey, seed])

  const toggle = (id: string) =>
    setDone((d) => {
      const next = { ...d, [id]: !d[id] }
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // Quota exceeded — toggle stays in memory.
      }
      return next
    })

  return (
    <div className="space-y-3">
      {steps.map((s) => (
        <Card key={s.id}>
          <CardContent className="p-4 flex items-start gap-3">
            <button
              type="button"
              onClick={() => toggle(s.id)}
              className={`mt-0.5 h-5 w-5 rounded-full border flex items-center justify-center ${done[s.id] ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-500" : "border-muted-foreground"}`}
              aria-label={done[s.id] ? "Mark incomplete" : "Mark done"}
            >
              {done[s.id] && <Check className="h-3 w-3" />}
            </button>
            <div className="flex-1">
              <div className="font-medium">{s.title}</div>
              <div className="text-sm text-muted-foreground">{s.description}</div>
            </div>
            {s.copy && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  await copyText(s.copy!)
                  onCopied?.()
                }}
              >
                <Copy className="mr-1 h-3 w-3" /> Copy
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
