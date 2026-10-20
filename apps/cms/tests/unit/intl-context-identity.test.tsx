// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it } from "vitest"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@siteinabox/ui/components/dialog"

describe("CMS and shared UI translation context", () => {
  it("renders shared primitives with the actual CMS provider and translated close label", () => {
    render(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ common: { close: "Close shared dialog" } }}>
        <Dialog open>
          <DialogContent>
            <DialogTitle>Shared context</DialogTitle>
            <DialogDescription>The CMS provider owns the shared primitive translations.</DialogDescription>
          </DialogContent>
        </Dialog>
      </NextIntlClientProvider>,
    )
    expect(screen.getByRole("button", { name: "Close shared dialog" })).toBeTruthy()
  })
})
