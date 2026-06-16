"use client"

import * as React from "react"

const CspNonceContext = React.createContext<string | undefined>(undefined)

export function CspNonceProvider({
  nonce,
  children,
}: {
  nonce?: string
  children: React.ReactNode
}) {
  const documentNonce = React.useRef(nonce)

  if (!documentNonce.current && nonce) {
    documentNonce.current = nonce
  }

  return (
    <CspNonceContext.Provider value={documentNonce.current}>
      {children}
    </CspNonceContext.Provider>
  )
}

export function useCspNonce(): string | undefined {
  return React.useContext(CspNonceContext)
}
