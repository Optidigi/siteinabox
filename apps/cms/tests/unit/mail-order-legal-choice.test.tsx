// @vitest-environment jsdom
import { render, cleanup, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
vi.mock("@/app/(frontend)/(admin)/email/actions",()=>({confirmCustomerMailOrder:vi.fn()}))
import { MailOrderConfirmation } from "@/app/(frontend)/(admin)/email/MailOrderConfirmation"
afterEach(cleanup)
it("displays and submits the explicitly selected legal language and statement",()=>{
 const statement="Ik ga akkoord met de algemene voorwaarden."
 const {container}=render(<MailOrderConfirmation tenantId={56} runId={1} legalVersion="fixture" termsHref="/terms-nl" privacyHref="/privacy-nl" manual nl={false} additionalSeats={false} legalLocale="nl" acceptanceStatement={statement} />)
 expect(screen.getByText(statement).getAttribute("lang")).toBe("nl")
 const form=container.querySelector("form");if(!form)throw Error("Confirmation missing")
 expect(new window.FormData(form).get("legalLocale")).toBe("nl")
})
