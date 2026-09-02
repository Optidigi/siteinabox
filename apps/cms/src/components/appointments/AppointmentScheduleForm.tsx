"use client"

import { useMemo, useState } from "react"
import { useFormStatus } from "react-dom"
import { useTranslations } from "next-intl"
import {
  APPOINTMENT_WEEKDAYS,
  DEFAULT_APPOINTMENT_SCHEDULE,
  type AppointmentDateOverride,
  type AppointmentScheduleSettings,
  type AppointmentTimeWindow,
  type AppointmentWeekday,
} from "@siteinabox/contracts"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Button } from "@siteinabox/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { Switch } from "@siteinabox/ui/components/switch"
import { saveAppointmentScheduleAction } from "@/app/(frontend)/(admin)/appointments/actions"

type DayForm = {
  weekday: AppointmentWeekday
  windows: AppointmentTimeWindow[]
}

const DEFAULT_WINDOW: AppointmentTimeWindow = { start: "09:00", end: "17:00" }

const buildDays = (initial: AppointmentScheduleSettings): DayForm[] => APPOINTMENT_WEEKDAYS.map((weekday) => ({
  weekday,
  windows: initial.weeklyAvailability.find((day) => day.weekday === weekday)?.windows.map((window) => ({ ...window })) ?? [],
}))

const buildOverrides = (initial: AppointmentScheduleSettings): AppointmentDateOverride[] =>
  initial.dateOverrides.map((override) => ({
    date: override.date,
    windows: override.windows.map((window) => ({ ...window })),
  }))

function SaveButton({ canEdit }: { canEdit: boolean }) {
  const { pending } = useFormStatus()
  const t = useTranslations("appointments")
  return (
    <Button type="submit" disabled={!canEdit || pending}>
      {pending ? t("saving") : t("saveSchedule")}
    </Button>
  )
}

export function AppointmentScheduleForm({
  initial,
  tenantId,
  returnPath,
  canEdit,
  result,
}: {
  initial: AppointmentScheduleSettings
  tenantId: string
  returnPath: string
  canEdit: boolean
  result?: string
}) {
  const t = useTranslations("appointments")
  const [settings, setSettings] = useState<AppointmentScheduleSettings>(() => ({
    ...DEFAULT_APPOINTMENT_SCHEDULE,
    ...initial,
  }))
  const [days, setDays] = useState<DayForm[]>(() => buildDays(initial))
  const [overrides, setOverrides] = useState<AppointmentDateOverride[]>(() => buildOverrides(initial))

  const schedule = useMemo<AppointmentScheduleSettings>(() => ({
    ...settings,
    weeklyAvailability: days.filter((day) => day.windows.length > 0),
    dateOverrides: overrides,
  }), [days, overrides, settings])

  const setNumber = (field: "durationMinutes" | "slotIntervalMinutes" | "bufferBeforeMinutes" | "bufferAfterMinutes" | "minimumNoticeMinutes" | "minimumCancellationNoticeMinutes" | "bookingWindowDays" | "retentionDays", value: string) => {
    setSettings((current) => ({ ...current, [field]: Number(value) }))
  }

  const setDayWindows = (index: number, windows: AppointmentTimeWindow[]) => {
    setDays((current) => current.map((day, dayIndex) => dayIndex === index ? { ...day, windows } : day))
  }

  const setWindow = (dayIndex: number, windowIndex: number, field: keyof AppointmentTimeWindow, value: string) => {
    const day = days[dayIndex]
    if (!day) return
    setDayWindows(dayIndex, day.windows.map((window, index) => index === windowIndex ? { ...window, [field]: value } : window))
  }

  const addWindow = (dayIndex: number) => {
    const day = days[dayIndex]
    if (!day || day.windows.length >= 4) return
    setDayWindows(dayIndex, [...day.windows, { ...DEFAULT_WINDOW }])
  }

  const removeWindow = (dayIndex: number, windowIndex: number) => {
    const day = days[dayIndex]
    if (!day) return
    setDayWindows(dayIndex, day.windows.filter((_, index) => index !== windowIndex))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("scheduleTitle")}</CardTitle>
        <CardDescription>{t("scheduleDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {result === "saved" && (
          <Alert variant="success" className="mb-6">
            <AlertTitle>{t("savedTitle")}</AlertTitle>
            <AlertDescription>{t("savedDescription")}</AlertDescription>
          </Alert>
        )}
        {result === "invalid_schedule" && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>{t("saveErrorTitle")}</AlertTitle>
            <AlertDescription>{t("saveErrorDescription")}</AlertDescription>
          </Alert>
        )}
        {!canEdit && (
          <Alert className="mb-6">
            <AlertTitle>{t("readOnlyTitle")}</AlertTitle>
            <AlertDescription>{t("readOnlyDescription")}</AlertDescription>
          </Alert>
        )}
        <form action={saveAppointmentScheduleAction} className="grid gap-8">
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <input type="hidden" name="schedule" value={JSON.stringify(schedule)} />

          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="grid gap-1">
              <Label htmlFor="appointments-enabled">{t("enabled")}</Label>
              <p className="text-sm text-muted-foreground">{t("enabledDescription")}</p>
            </div>
            <Switch
              id="appointments-enabled"
              checked={settings.enabled}
              onCheckedChange={(enabled) => setSettings((current) => ({ ...current, enabled }))}
              disabled={!canEdit}
              aria-label={t("enabled")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="grid gap-2 text-sm font-medium">
              <span>{t("timezone")}</span>
              <Input value={settings.timezone} onChange={(event) => setSettings((current) => ({ ...current, timezone: event.target.value }))} disabled={!canEdit} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              <span>{t("duration")}</span>
              <Input type="number" min={5} max={480} step={5} value={settings.durationMinutes} onChange={(event) => setNumber("durationMinutes", event.target.value)} disabled={!canEdit} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              <span>{t("slotInterval")}</span>
              <Input type="number" min={5} max={480} step={5} value={settings.slotIntervalMinutes} onChange={(event) => setNumber("slotIntervalMinutes", event.target.value)} disabled={!canEdit} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              <span>{t("bufferBefore")}</span>
              <Input type="number" min={0} max={240} step={5} value={settings.bufferBeforeMinutes} onChange={(event) => setNumber("bufferBeforeMinutes", event.target.value)} disabled={!canEdit} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              <span>{t("bufferAfter")}</span>
              <Input type="number" min={0} max={240} step={5} value={settings.bufferAfterMinutes} onChange={(event) => setNumber("bufferAfterMinutes", event.target.value)} disabled={!canEdit} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              <span>{t("minimumNotice")}</span>
              <Input type="number" min={0} max={10080} step={15} value={settings.minimumNoticeMinutes} onChange={(event) => setNumber("minimumNoticeMinutes", event.target.value)} disabled={!canEdit} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              <span>{t("minimumCancellationNotice")}</span>
              <Input type="number" min={0} max={10080} step={15} value={settings.minimumCancellationNoticeMinutes} onChange={(event) => setNumber("minimumCancellationNoticeMinutes", event.target.value)} disabled={!canEdit} />
            </label>
            <label className="grid gap-2 text-sm font-medium sm:col-span-2 lg:col-span-1">
              <span>{t("bookingWindow")}</span>
              <Input type="number" min={1} max={366} step={1} value={settings.bookingWindowDays} onChange={(event) => setNumber("bookingWindowDays", event.target.value)} disabled={!canEdit} />
            </label>
            <label className="grid gap-2 text-sm font-medium sm:col-span-2 lg:col-span-1">
              <span>{t("retentionDays")}</span>
              <Input type="number" min={30} max={730} step={1} value={settings.retentionDays} onChange={(event) => setNumber("retentionDays", event.target.value)} disabled={!canEdit} />
            </label>
          </div>

          <fieldset disabled={!canEdit} className="grid gap-3">
            <legend className="text-sm font-semibold">{t("weeklyTitle")}</legend>
            <p className="text-sm text-muted-foreground">{t("weeklyDescription")}</p>
            <div className="grid gap-3">
              {days.map((day, dayIndex) => {
                const open = day.windows.length > 0
                return (
                  <div key={day.weekday} className="grid gap-3 rounded-lg border p-4 lg:grid-cols-[12rem_1fr] lg:items-start">
                    <div className="flex items-center justify-between gap-3 lg:pt-1">
                      <Label htmlFor={`appointments-${day.weekday}`}>{t(`days.${day.weekday}`)}</Label>
                      <Switch
                        id={`appointments-${day.weekday}`}
                        checked={open}
                        onCheckedChange={(checked) => setDayWindows(dayIndex, checked ? [{ ...DEFAULT_WINDOW }] : [])}
                        aria-label={t(`days.${day.weekday}`)}
                      />
                    </div>
                    {open ? (
                      <div className="grid gap-2">
                        {day.windows.map((window, windowIndex) => (
                          <div key={`${day.weekday}-${windowIndex}`} className="flex flex-wrap items-end gap-2">
                            <label className="grid min-w-32 flex-1 gap-1 text-xs text-muted-foreground">
                              <span>{t("from")}</span>
                              <Input type="time" value={window.start} onChange={(event) => setWindow(dayIndex, windowIndex, "start", event.target.value)} />
                            </label>
                            <label className="grid min-w-32 flex-1 gap-1 text-xs text-muted-foreground">
                              <span>{t("to")}</span>
                              <Input type="time" value={window.end} onChange={(event) => setWindow(dayIndex, windowIndex, "end", event.target.value)} />
                            </label>
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeWindow(dayIndex, windowIndex)} aria-label={t("removeWindow")}>{t("remove")}</Button>
                          </div>
                        ))}
                        {day.windows.length < 4 && <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => addWindow(dayIndex)}>{t("addWindow")}</Button>}
                      </div>
                    ) : <p className="text-sm text-muted-foreground lg:pt-1">{t("closed")}</p>}
                  </div>
                )
              })}
            </div>
          </fieldset>

          <fieldset disabled={!canEdit} className="grid gap-3">
            <legend className="text-sm font-semibold">{t("overridesTitle")}</legend>
            <p className="text-sm text-muted-foreground">{t("overridesDescription")}</p>
            {overrides.map((override, overrideIndex) => (
              <div key={`override-${overrideIndex}`} className="grid gap-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-end gap-2">
                  <label className="grid min-w-48 gap-1 text-xs text-muted-foreground">
                    <span>{t("date")}</span>
                    <Input type="date" value={override.date} onChange={(event) => setOverrides((current) => current.map((item, index) => index === overrideIndex ? { ...item, date: event.target.value } : item))} />
                  </label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setOverrides((current) => current.filter((_, index) => index !== overrideIndex))}>{t("remove")}</Button>
                </div>
                {override.windows.length > 0 ? (
                  <div className="grid gap-2">
                    {override.windows.map((window, windowIndex) => (
                      <div key={`override-${overrideIndex}-window-${windowIndex}`} className="flex flex-wrap items-end gap-2">
                        <label className="grid min-w-32 flex-1 gap-1 text-xs text-muted-foreground">
                          <span>{t("from")}</span>
                          <Input type="time" value={window.start} onChange={(event) => setOverrides((current) => current.map((item, index) => index === overrideIndex ? { ...item, windows: item.windows.map((entry, entryIndex) => entryIndex === windowIndex ? { ...entry, start: event.target.value } : entry) } : item))} />
                        </label>
                        <label className="grid min-w-32 flex-1 gap-1 text-xs text-muted-foreground">
                          <span>{t("to")}</span>
                          <Input type="time" value={window.end} onChange={(event) => setOverrides((current) => current.map((item, index) => index === overrideIndex ? { ...item, windows: item.windows.map((entry, entryIndex) => entryIndex === windowIndex ? { ...entry, end: event.target.value } : entry) } : item))} />
                        </label>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setOverrides((current) => current.map((item, index) => index === overrideIndex ? { ...item, windows: item.windows.filter((_, entryIndex) => entryIndex !== windowIndex) } : item))}>{t("remove")}</Button>
                      </div>
                    ))}
                    {override.windows.length < 4 && <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setOverrides((current) => current.map((item, index) => index === overrideIndex ? { ...item, windows: [...item.windows, { ...DEFAULT_WINDOW }] } : item))}>{t("addWindow")}</Button>}
                    <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setOverrides((current) => current.map((item, index) => index === overrideIndex ? { ...item, windows: [] } : item))}>{t("closeDate")}</Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-muted-foreground">{t("closed")}</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => setOverrides((current) => current.map((item, index) => index === overrideIndex ? { ...item, windows: [{ ...DEFAULT_WINDOW }] } : item))}>{t("openDate")}</Button>
                  </div>
                )}
              </div>
            ))}
            {overrides.length < 366 && (
              <Button type="button" variant="outline" className="w-fit" onClick={() => setOverrides((current) => [...current, { date: "", windows: [{ ...DEFAULT_WINDOW }] }])}>{t("addOverride")}</Button>
            )}
          </fieldset>

          <div className="flex justify-end border-t pt-6">
            <SaveButton canEdit={canEdit} />
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
