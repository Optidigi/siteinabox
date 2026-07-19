import type { PayloadRequest } from "payload"

export type PayloadRequestArg = PayloadRequest | Partial<PayloadRequest> | undefined

export const payloadRequestArgs = (req?: PayloadRequestArg) => (req ? { req } : {})
