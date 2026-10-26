import "server-only"
import type { Payload } from "payload"
import type { MicrosoftMailProvisioningRun as PayloadRun } from "@/payload-types"
import type {
  MicrosoftMailProvisioningRun,
  MicrosoftMailProvisioningRunCreate,
  MicrosoftMailProvisioningStore,
} from "./workflow.ts"

const lifecycleContext = { microsoftMailProvisioningLifecycle: true }

export class PayloadMicrosoftMailProvisioningStore implements MicrosoftMailProvisioningStore {
  readonly #payload: Payload

  constructor(payload: Payload) { this.#payload = payload }

  async findByIdempotencyKey(key: string): Promise<MicrosoftMailProvisioningRun | null> {
    const result = await this.#payload.find({
      collection: "microsoft-mail-provisioning-runs",
      where: { idempotencyKey: { equals: key } },
      limit: 1,
      overrideAccess: true,
    })
    return result.docs[0] ? this.#map(result.docs[0] as unknown as Record<string, unknown>) : null
  }

  async create(input: MicrosoftMailProvisioningRunCreate): Promise<MicrosoftMailProvisioningRun> {
    const doc = await this.#payload.create({
      collection: "microsoft-mail-provisioning-runs",
      data: input as unknown as Omit<PayloadRun, "id" | "createdAt" | "updatedAt" | "collection" | "deletedAt">,
      overrideAccess: true,
      draft: false,
      context: lifecycleContext,
    })
    return this.#map(doc as unknown as Record<string, unknown>)
  }

  async update(id: string | number, patch: Partial<MicrosoftMailProvisioningRun>): Promise<MicrosoftMailProvisioningRun> {
    const doc = await this.#payload.update({
      collection: "microsoft-mail-provisioning-runs",
      id,
      data: patch as unknown as Partial<PayloadRun>,
      overrideAccess: true,
      context: lifecycleContext,
    })
    return this.#map(doc as unknown as Record<string, unknown>)
  }

  async get(id: string | number): Promise<MicrosoftMailProvisioningRun | null> {
    const result = await this.#payload.findByID({
      collection: "microsoft-mail-provisioning-runs",
      id,
      overrideAccess: true,
    }).catch(() => null)
    return result ? this.#map(result as unknown as Record<string, unknown>) : null
  }

  #map(doc: Record<string, unknown>): MicrosoftMailProvisioningRun {
    return {
      ...doc,
      id: doc.id as string | number,
      idempotencyKey: String(doc.idempotencyKey),
      mode: doc.mode as "mock" | "live",
      tenantId: Number(doc.tenantId),
      domain: String(doc.domain),
      tenantPrefix: String(doc.tenantPrefix),
      request: doc.request as MicrosoftMailProvisioningRun["request"],
      state: doc.state as MicrosoftMailProvisioningRun["state"],
      currentStep: doc.currentStep as MicrosoftMailProvisioningRun["currentStep"],
      completedSteps: doc.completedSteps as MicrosoftMailProvisioningRun["completedSteps"],
      data: doc.data as Record<string, unknown>,
      actionUrl: doc.actionUrl as string | null,
      issueCode: doc.issueCode as string | null,
      createdAt: String(doc.createdAt),
      updatedAt: String(doc.updatedAt),
    }
  }
}
