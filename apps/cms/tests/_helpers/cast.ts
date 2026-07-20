import type { NextRequest } from "next/server"
import type { LegalDocument as LegalDocumentDoc, LegalRequirement, SiteGenerationRun, Tenant, PublishedSiteSnapshot } from "@/payload-types"
import type { LegalDocument } from "@siteinabox/legal-content"
import type { MockDoc } from "./mockPayload"

/** Typed test cast — prefer constructing valid shapes; use only when unavoidable. */
export function cast<T>(value: unknown): T {
  return value as T
}

export function asMockDoc(value: unknown): MockDoc {
  return value as MockDoc
}

export function asNextRequest(value: unknown): NextRequest {
  return value as NextRequest
}

export function errLike(value: unknown): { status?: number; data?: Record<string, unknown>; message?: string } {
  return value as { status?: number; data?: Record<string, unknown>; message?: string }
}

export function asGenerationRun(value: unknown): SiteGenerationRun {
  return value as SiteGenerationRun
}

export function asTenant(value: unknown): Tenant {
  return value as Tenant
}

export function asPublishedSnapshot(value: unknown): PublishedSiteSnapshot {
  return value as PublishedSiteSnapshot
}

export function asLegalDocumentDoc(value: unknown): LegalDocumentDoc {
  return value as LegalDocumentDoc
}

export function asLegalRelease(value: unknown): LegalDocument {
  return value as LegalDocument
}

export function asRequirementDoc(value: unknown): LegalRequirement {
  return value as LegalRequirement
}

export function validationErrorData(err: unknown): { errors?: Array<{ path?: string; message?: string }> } | undefined {
  return errLike(err).data as { errors?: Array<{ path?: string; message?: string }> } | undefined
}

export function rtParagraphChildren(root: unknown): unknown {
  return asMockDoc(asMockDoc(asMockDoc(root).children)[0]).children
}
