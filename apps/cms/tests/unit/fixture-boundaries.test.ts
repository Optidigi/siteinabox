import { describe, expect, expectTypeOf, it, vi } from "vitest"
import { BasePayload, type Payload, type TaskConfig } from "payload"
import { createTestPayload, createTestRequest } from "../_helpers/testPayload"
import { createArgs, updateArgs } from "../_helpers/payloadApi"
import { createTaskRunner } from "../_helpers/taskRunner"
import { generationRunFixture, pageFixture, userFixture } from "../_helpers/generatedDocs"

it("builds generated documents without missing required fields", () => {
  expectTypeOf(generationRunFixture).returns.toEqualTypeOf<import("@/payload-types").SiteGenerationRun>()
  expectTypeOf(pageFixture).returns.toEqualTypeOf<import("@/payload-types").Page>()
  expect(userFixture().collection).toBe("users")
})

describe("actual Payload fixture boundary", () => {
  it("uses a real instance and a typed method spy", async () => {
    const payload = createTestPayload()
    expect(payload).toBeInstanceOf(BasePayload)
    expectTypeOf(payload).toEqualTypeOf<Payload>()
    const count = vi.spyOn(payload, "count").mockResolvedValue({ totalDocs: 2 })
    await expect(payload.count({ collection: "pages" })).resolves.toEqual({ totalDocs: 2 })
    expect(count).toHaveBeenCalledWith({ collection: "pages" })
  })

  it("constructs the installed Local API request without initializing a database", async () => {
    const payload = createTestPayload()
    const request = await createTestRequest(payload)
    expect(request.payload).toBe(payload)
    expect(request.user).toBeNull()
    expect(request.headers).toBeInstanceOf(Headers)
    expect(request.payloadAPI).toBe("local")
    expect(payload.db).toBeUndefined()
  })

  it("calls a configured handler with the actual complete argument contract", async () => {
    const payload = createTestPayload()
    const task: TaskConfig<{ input: { id: string }; output: { id: string } }> = {
      slug: "fixture", handler: ({ input, req, job, tasks }) => {
        expect(req.payload).toBe(payload)
        expect(job.id).toBe(1)
        expect(typeof tasks["fulfill-order"]).toBe("function")
        return { output: input }
      },
    }
    await expect(createTaskRunner(task)({ input: { id: "fixture" }, req: { payload } })).resolves.toEqual({ output: { id: "fixture" } })
  })
})

it("keeps write fixtures collection-aware and rejects retired or incomplete documents", () => {
  type PageCreate = Parameters<typeof createArgs<"pages">>[1]
  type UserCreate = Parameters<typeof createArgs<"users">>[1]
  expectTypeOf<PageCreate>().toEqualTypeOf<import("payload").RequiredDataFromCollectionSlug<"pages">>()
  expectTypeOf<{ title: string; slug: string }>().not.toExtend<PageCreate>()
  expectTypeOf<{ title: string; slug: string; status: "draft"; blocks: [{ blockType: "comparison" }] }>().not.toExtend<PageCreate>()
  expectTypeOf<{ email: string; role: "invented" }>().not.toExtend<UserCreate>()
  expectTypeOf<{ status: "invented" }>().not.toExtend<Parameters<typeof updateArgs<"pages">>[2]>()
})
