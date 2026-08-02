"use client"

import { useTranslations } from "next-intl"
import { CheckoutTextField } from "./CheckoutTextField"

type AutomaticMigrationSourceMethod = "cloudflare_api_v1" | "authorized_axfr_v1"

export function MigrationSourceEvidenceFields({
  mechanism,
  idPrefix,
}: {
  mechanism: AutomaticMigrationSourceMethod | null | undefined
  idPrefix: string
}) {
  const t = useTranslations("preview")
  if (mechanism !== "authorized_axfr_v1") return null
  return (
    <>
      <CheckoutTextField
        id={`${idPrefix}-axfr-nameserver`}
        name="axfrNameserver"
        label={t("checkoutMigrationAxfrNameserverLabel")}
        description={t("checkoutMigrationAxfrNameserverHelp")}
        value={undefined}
        autoComplete="off"
        required
      />
      <CheckoutTextField
        id={`${idPrefix}-axfr-tsig-name`}
        name="axfrTsigName"
        label={t("checkoutMigrationAxfrTsigNameLabel")}
        description={t("checkoutMigrationAxfrTsigHelp")}
        value={undefined}
        autoComplete="off"
      />
      <CheckoutTextField
        id={`${idPrefix}-axfr-tsig-secret`}
        name="axfrTsigSecret"
        type="password"
        label={t("checkoutMigrationAxfrTsigSecretLabel")}
        value={undefined}
        autoComplete="off"
      />
    </>
  )
}
