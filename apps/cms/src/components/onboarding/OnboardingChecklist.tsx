"use client"

import { Card, CardContent } from "@siteinabox/ui/components/card"
import { AlertTriangle, Check, Clock } from "lucide-react"
import { useTranslations } from "next-intl"

type RoutingState = {
  authoritativeDnsStatus: string
  edgeRoutingStatus: string
  httpsStatus: string
  adminHttpsStatus: string
  customerStatus: string
} | null

export function OnboardingChecklist({
  tenant,
  routing,
}: {
  tenant: { domain: string; id: number | string }
  routing: RoutingState
}) {
  const t = useTranslations("onboarding")
  const failed = routing?.edgeRoutingStatus === "failed"
  const steps = [
    {
      id: "tenant",
      title: t("siteRecordCreated"),
      description: t("doneWithId", { id: String(tenant.id) }),
      ready: true,
    },
    {
      id: "dns",
      title: t("automaticDns"),
      description: t("automaticDnsDescription"),
      ready: routing?.authoritativeDnsStatus === "verified",
    },
    {
      id: "edge",
      title: t("automaticRouting"),
      description: t("automaticRoutingDescription"),
      ready: routing?.edgeRoutingStatus === "active",
    },
    {
      id: "certificate",
      title: t("automaticCertificates"),
      description: t("automaticCertificatesDescription"),
      ready:
        routing?.httpsStatus === "verified" &&
        routing?.adminHttpsStatus === "verified",
    },
    {
      id: "handoff",
      title: t("automaticHandoff"),
      description: t("automaticHandoffDescription"),
      ready: routing?.customerStatus === "active",
    },
  ]

  return (
    <div className="space-y-3" aria-live="polite">
      {steps.map((step) => (
        <Card key={step.id}>
          <CardContent className="flex items-start gap-3 p-4">
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                step.ready
                  ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-600"
                  : failed
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-muted-foreground/30 text-muted-foreground"
              }`}
              aria-label={step.ready ? t("ready") : failed ? t("failed") : t("waiting")}
            >
              {step.ready
                ? <Check className="h-3.5 w-3.5" />
                : failed
                  ? <AlertTriangle className="h-3.5 w-3.5" />
                  : <Clock className="h-3.5 w-3.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{step.title}</div>
              <div className="text-sm text-muted-foreground">{step.description}</div>
            </div>
          </CardContent>
        </Card>
      ))}
      {routing?.adminHttpsStatus === "verified" && tenant.domain ? (
        <a
          href={`https://admin.${tenant.domain}`}
          className="inline-flex min-h-11 items-center underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("openAdmin")}
        </a>
      ) : null}
    </div>
  )
}
