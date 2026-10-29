"use client"

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import { Checkbox } from "@siteinabox/ui/components/checkbox"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { Card, CardContent } from "@siteinabox/ui/components/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@siteinabox/ui/components/select"
import { submitCustomerMicrosoftMailRequest } from "./actions"

type MailboxRow = { localPart: string; displayName: string; setupEmail: string }
type Organization = { companyName: string; website: string; phone: string; registrationNumber: string; address: { street: string; city: string; postalCode: string; country: string } }

export function CustomerMailOrderForm({ tenantName, tenantDomain, userName, userEmail, organization, allowInfoAlias = true }: {
  tenantName: string
  tenantDomain: string
  userName: string
  userEmail: string
  organization?: Organization
  allowInfoAlias?: boolean
}) {
  const t = useTranslations("emailService")
  const router = useRouter()
  const formRef = useRef<HTMLFormElement | null>(null)
  const [actionState, formAction, pending] = useActionState(submitCustomerMicrosoftMailRequest, null)
  const [step, setStep] = useState(1)
  const [domain, setDomain] = useState(tenantDomain)
  const [tenantPrefix, setTenantPrefix] = useState(tenantDomain.split(".")[0] ?? "")
  const [users, setUsers] = useState<MailboxRow[]>([{ localPart: "", displayName: "", setupEmail: "" }])
  const [infoSharedMailbox, setInfoSharedMailbox] = useState(false)
  const [showInfoAlias, setShowInfoAlias] = useState(false)
  const [infoAliasTarget, setInfoAliasTarget] = useState("")
  const [aliasError, setAliasError] = useState(false)
  const defaultName = userName.trim().split(/\s+/)

  useEffect(() => {
    if (actionState?.ok) router.replace(`/email?request=${actionState.requestId}`)
  }, [actionState, router])

  const updateUser = (index: number, field: keyof MailboxRow, value: string) => {
    if (field === "localPart") value = value.trim().toLowerCase()
    const currentUser = users[index]
    if (field === "localPart" && currentUser?.localPart === infoAliasTarget) setInfoAliasTarget(value)
    setUsers((current) => current.map((user, row) => row === index ? { ...user, [field]: value } : user))
  }

  const removeUser = (index: number) => {
    const removed = users[index]
    const remaining = users.filter((_, row) => row !== index)
    setUsers(remaining)
    if (removed?.localPart === infoAliasTarget) setInfoAliasTarget("")
  }

  const validateSection = (sectionStep: number): boolean => {
    const section = formRef.current?.querySelector<HTMLElement>(`[data-step-section="${sectionStep}"]`)
    if (!section) return true
    const fields = [...section.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")]
    const invalid = fields.find((field) => !field.checkValidity())
    if (!invalid) return true
    invalid.reportValidity()
    return false
  }

  const continueToReview = () => {
    if (validateSection(1)) setStep(2)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    for (const sectionStep of [1, 2]) {
      if (!validateSection(sectionStep)) {
        event.preventDefault()
        setStep(sectionStep)
        return
      }
    }
    if (showInfoAlias && (!users.some((user) => user.localPart === infoAliasTarget && user.localPart.trim()) || infoAliasTarget.toLowerCase() === "info")) {
      event.preventDefault()
      setAliasError(true)
      setStep(1)
      return
    }
  }

  return <form ref={formRef} action={formAction} noValidate onSubmit={handleSubmit} className="grid gap-4">
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-2 py-4 text-sm">
        <span className="font-medium">{t("planValue")}</span>
        <span className="text-muted-foreground">{t("commitmentValue")}</span>
      </CardContent>
    </Card>

    <ol aria-label={t("stepsLabel")} className="grid grid-cols-2 gap-2">
      {[t("stepMailboxes"), t("stepReview")].map((label, index) => <li key={label}>
        <div aria-current={step === index + 1 ? "step" : undefined} className={`rounded-base border px-3 py-2 text-sm ${step === index + 1 ? "border-primary bg-primary/5" : "bg-card text-muted-foreground"}`}>
          <span className="mr-2 text-xs">{index + 1}</span><span className="font-medium">{label}</span>
        </div>
      </li>)}
    </ol>

    <section data-step-section="1" hidden={step !== 1} className="grid gap-4 rounded-base border-2 border-border bg-card p-4 shadow-shadow">
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="mail-domain" name="domain" label={t("domain")} placeholder="example.nl" value={domain} onChange={(value) => {
          const normalized = value.trim().toLowerCase()
          setDomain(normalized)
          setTenantPrefix(normalized.split(".")[0] ?? "")
        }} required />
      </div>
      <input type="hidden" name="tenantPrefix" value={tenantPrefix} />

      <input type="hidden" name="mailboxUsers" value={JSON.stringify(users)} />
      {users.map((user, index) => <div key={index} className="grid gap-3 rounded-base border p-3 md:grid-cols-[1fr_1fr_1.2fr_auto] md:items-end">
        <Field id={`mailbox-local-${index}`} label={t("mailboxName")} placeholder="ardi" value={user.localPart} onChange={(value) => updateUser(index, "localPart", value)} required />
        <Field id={`mailbox-display-${index}`} label={t("displayName")} placeholder="Ardi Example" value={user.displayName} onChange={(value) => updateUser(index, "displayName", value)} required />
        <Field id={`mailbox-setup-${index}`} label={t("setupEmail")} type="email" placeholder="you@example.nl" value={user.setupEmail} onChange={(value) => updateUser(index, "setupEmail", value)} required />
        <Button type="button" variant="outline" aria-label={t("removeMailbox", { number: index + 1 })} disabled={users.length <= 1} onClick={() => removeUser(index)}><Trash2 aria-hidden /></Button>
      </div>)}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="w-fit" disabled={users.length >= 300} onClick={() => setUsers((current) => [...current, { localPart: "", displayName: "", setupEmail: "" }])}><Plus aria-hidden /> {t("addMailbox")}</Button>
        {allowInfoAlias && !infoSharedMailbox && !showInfoAlias ? <Button type="button" variant="outline" className="w-fit" onClick={() => {
          setShowInfoAlias(true)
          setInfoAliasTarget(users.find((user) => user.localPart)?.localPart ?? "")
        }}><Plus aria-hidden /> {t("addInfoAlias")}</Button> : null}
      </div>

      {allowInfoAlias && !showInfoAlias ? <label className="flex items-start gap-2 text-sm"><Checkbox name="infoSharedMailbox" checked={infoSharedMailbox} onCheckedChange={value => setInfoSharedMailbox(value === true)} /><span>Shared info@{domain} inbox · Full Access + Send As for all requested mailboxes. Replaces existing info@ forwarding.</span></label> : null}
      <input type="hidden" name="infoAliasTarget" value={infoAliasTarget ? `${infoAliasTarget}@${domain}` : ""} />
      {showInfoAlias ? <div className="flex flex-wrap items-center gap-3 rounded-base border p-3">
        <span className="text-sm font-medium">info@{domain || "…"}</span>
        <span className="text-sm text-muted-foreground">{t("deliveredTo")}</span>
        <Select value={infoAliasTarget || undefined} onValueChange={(value) => { setInfoAliasTarget(value); setAliasError(false) }}>
          <SelectTrigger className="min-w-56 flex-1" aria-label={t("deliveredTo")}><SelectValue placeholder={t("chooseMailbox")} /></SelectTrigger>
          <SelectContent>{users.flatMap((user) => user.localPart && user.localPart.toLowerCase() !== "info" ? <SelectItem key={user.localPart} value={user.localPart}>{user.displayName || user.localPart} · {user.localPart}@{domain}</SelectItem> : [])}</SelectContent>
        </Select>
        <Button type="button" variant="ghost" className="text-sm text-muted-foreground underline underline-offset-4" onClick={() => {
          setShowInfoAlias(false)
          setInfoAliasTarget("")
          setAliasError(false)
        }}>{t("removeAlias")}</Button>
        {aliasError ? <p className="basis-full text-sm text-destructive">{t("chooseMailboxError")}</p> : null}
      </div> : null}

      <Button type="button" className="w-fit" onClick={continueToReview}>{t("continue")}</Button>
    </section>

    <section data-step-section="2" hidden={step !== 2} className="grid gap-4 rounded-base border-2 border-border bg-card p-4 shadow-shadow">
      <div className="grid gap-3 md:grid-cols-2">
        <Field id="mail-company-name" name="companyName" label={t("companyName")} defaultValue={organization?.companyName ?? tenantName} required />
        <Field id="mail-website" name="website" label={t("website")} placeholder="https://example.nl" defaultValue={organization?.website ?? (tenantDomain ? `https://${tenantDomain}` : "")} required />
        <Field id="mail-company-phone" name="companyPhone" label={t("companyPhone")} type="tel" defaultValue={organization?.phone} required />
        <input type="hidden" name="registrationNumber" value={organization?.registrationNumber ?? ""} />
        <Field id="mail-street" name="street" label={t("street")} defaultValue={organization?.address.street} required />
        <Field id="mail-city" name="city" label={t("city")} defaultValue={organization?.address.city} required />
        <Field id="mail-postal-code" name="postalCode" label={t("postalCode")} defaultValue={organization?.address.postalCode} required />
        <Field id="mail-country" name="country" label={t("country")} defaultValue={organization?.address.country ?? "NL"} required />
      </div>

      <div className="rounded-base border bg-muted/30 p-3 text-sm">
        <p className="font-medium">{t("orderStatus", { domain: domain || "…", quantity: users.length })}</p>
        <ul className="mt-2 grid gap-1">{users.map((user, index) => <li key={index}>{user.displayName || user.localPart || t("mailboxName")} · <strong>{user.localPart || "…"}@{domain || "…"}</strong></li>)}</ul>
        {infoAliasTarget ? <p className="mt-2">info@{domain} · {t("deliveredTo")} <strong>{infoAliasTarget}@{domain}</strong></p> : null}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Field id="agreement-signatory-first" name="signatoryFirstName" label={t("signatoryFirstName")} defaultValue={defaultName[0] ?? ""} required />
        <Field id="agreement-signatory-last" name="signatoryLastName" label={t("signatoryLastName")} defaultValue={defaultName.slice(1).join(" ")} required />
        <Field id="agreement-signatory-email" name="signatoryEmail" label={t("signatoryEmail")} type="email" defaultValue={userEmail} required />
      </div>
      <a className="text-sm underline" href="https://aka.ms/customeragreement" target="_blank" rel="noopener noreferrer">{t("agreementLink")}</a>
      <label className="flex items-start gap-3 text-sm">
        <Checkbox name="acceptMca" required />
        <span>{t("agreementAcceptance")}</span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <Checkbox name="authorizeService" required />
        <span>{t("serviceAuthorization")}</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setStep(1)}>{t("back")}</Button>
        <Button type="submit" disabled={pending}>{pending ? t("saving") : t("submit")}</Button>
      </div>
      {actionState ? <p role="status" className={actionState.ok ? "rounded-base border border-primary/30 bg-primary/5 p-3 text-sm" : "rounded-base border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"}>{actionState.message}</p> : null}
    </section>
  </form>
}

function Field(props: {
  id: string; label: string; name?: string; type?: string; placeholder?: string; defaultValue?: string;
  value?: string; onChange?: (value: string) => void; required?: boolean
}) {
  return <div className="grid gap-2">
    <Label htmlFor={props.id}>{props.label}</Label>
    <Input id={props.id} name={props.name} type={props.type ?? "text"} placeholder={props.placeholder}
      defaultValue={props.value === undefined ? props.defaultValue : undefined} value={props.value}
      onChange={props.onChange ? (event) => props.onChange?.(event.target.value) : undefined} required={props.required} />
  </div>
}
