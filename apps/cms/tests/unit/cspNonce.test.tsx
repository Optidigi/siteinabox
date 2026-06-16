// @vitest-environment jsdom
import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CspNonceProvider, useCspNonce } from "@siteinabox/ui/lib/csp-nonce"

function NonceProbe() {
  return <output data-testid="nonce">{useCspNonce() ?? ""}</output>
}

describe("CspNonceProvider", () => {
  it("exposes the request CSP nonce to client components", () => {
    render(
      <CspNonceProvider nonce="nonce-for-style-tags">
        <NonceProbe />
      </CspNonceProvider>,
    )

    expect(screen.getByTestId("nonce").textContent).toBe("nonce-for-style-tags")
  })

  it("returns undefined when no nonce was provided", () => {
    render(
      <CspNonceProvider>
        <NonceProbe />
      </CspNonceProvider>,
    )

    expect(screen.getByTestId("nonce").textContent).toBe("")
  })

  it("pins the first document nonce across client-side refresh rerenders", () => {
    const { rerender } = render(
      <CspNonceProvider nonce="initial-document-nonce">
        <NonceProbe />
      </CspNonceProvider>,
    )

    rerender(
      <CspNonceProvider nonce="new-rsc-request-nonce">
        <NonceProbe />
      </CspNonceProvider>,
    )

    expect(screen.getByTestId("nonce").textContent).toBe("initial-document-nonce")
  })

  it("adopts the first later nonce if the initial render did not have one", () => {
    const { rerender } = render(
      <CspNonceProvider>
        <NonceProbe />
      </CspNonceProvider>,
    )

    rerender(
      <CspNonceProvider nonce="hydrated-document-nonce">
        <NonceProbe />
      </CspNonceProvider>,
    )

    expect(screen.getByTestId("nonce").textContent).toBe("hydrated-document-nonce")
  })
})
