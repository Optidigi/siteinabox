import { refundScenarios, type RefundScenario } from "@siteinabox/contracts/commerce"
import type { TaskConfig } from "payload"

export const requestMollieRefundTask: TaskConfig<{
  input: { paymentAttemptId: string; scenario: RefundScenario }
  output: { accountingDocumentId: string; providerRefundId: string; reused: boolean }
}> = {
  slug: "request-mollie-refund",
  label: "Request governed Mollie refund",
  concurrency: {
    key: ({ input }) => `mollie-refund:${input.paymentAttemptId}`,
    exclusive: true,
  },
  retries: 0,
  inputSchema: [
    { name: "paymentAttemptId", type: "text", required: true },
    {
      name: "scenario",
      type: "select",
      required: true,
      options: refundScenarios.map((value) => ({ label: value, value })),
    },
  ],
  outputSchema: [
    { name: "accountingDocumentId", type: "text", required: true },
    { name: "providerRefundId", type: "text", required: true },
    { name: "reused", type: "checkbox", required: true },
  ],
  handler: async ({ input, req }) => {
    const { requestMollieRefund } = await import("@/lib/payments/molliePayments")
    const result = await requestMollieRefund(req.payload, input)
    return {
      output: {
        accountingDocumentId: String(result.document.id),
        providerRefundId: result.providerRefundId,
        reused: result.reused,
      },
    }
  },
}
