import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

const read = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), "utf8")
const legacyImport = "so" + "nner"
const legacyCall = "to" + "ast."

describe("FE-79 media library upload refresh", () => {
  it("MediaUploader exposes an explicit refresh-on-upload path", () => {
    const source = read("src/components/media/MediaUploader.tsx")

    expect(source).toContain("refreshOnUploaded = false")
    expect(source).toContain("const router = useRouter()")
    expect(source).toContain("if (refreshOnUploaded) router.refresh()")
  })

  it("MediaUploader transitions one status badge from uploading to success or failure", () => {
    const source = read("src/components/media/MediaUploader.tsx")

    expect(source).toContain("useStatusFeedback")
    expect(source).toContain('const statusId = status.loading(t("uploading"))')
    expect(source).toContain('status.success(t("uploaded", { name: file.name }), { id: statusId })')
    expect(source).toContain('status.error(message || `${t("uploadFailed")} (${res.status})`, { id: statusId })')
    expect(source).toContain('status.error(err instanceof Error ? err.message : t("uploadFailed"), { id: statusId })')
    expect(source).not.toContain(legacyImport)
    expect(source).not.toContain(legacyCall)
  })

  it("standalone media library pages opt into route refresh after upload", () => {
    expect(read("src/app/(frontend)/(admin)/media/page.tsx")).toContain(
      "<MediaUploader tenantId={ctx.tenant.id} refreshOnUploaded />",
    )
    expect(read("src/app/(frontend)/(admin)/sites/[slug]/media/page.tsx")).toContain(
      "<MediaUploader tenantId={tenant.id} refreshOnUploaded />",
    )
  })

  it("picker flows stay callback-driven instead of forcing page refresh", () => {
    const mediaPicker = read("src/components/media/MediaPicker.tsx")
    expect(mediaPicker).toContain(
      "onUploaded={(media) => { void reload(); onChange(media); setOpen(false) }}",
    )
    expect(mediaPicker).not.toContain("refreshOnUploaded")
  })

  it("MediaPicker keeps selected media populated so editor previews update immediately", () => {
    const source = read("src/components/media/MediaPicker.tsx")

    expect(source).toContain("onSelect={(m) => { onChange(m); setOpen(false) }}")
    expect(source).toContain("submit handlers normalize")
    expect(source).not.toContain("onSelect={(m) => { onChange(m.id); setOpen(false) }}")
  })

  it("MediaGrid prunes stale selected IDs when deleted items disappear", () => {
    const source = read("src/components/media/MediaGrid.tsx")

    expect(source).toContain("const liveIds = new Set(items.map((m) => m.id as number | string))")
    expect(source).toContain("Array.from(current).filter((id) => liveIds.has(id))")
    expect(source).toContain("setConfirmFor(null)")
    expect(source).toContain("setUsageFor(null)")
    expect(source).toContain("next.delete(m.id as number | string)")
  })

  it("MediaGrid transitions one status badge from deleting to delete result", () => {
    const source = read("src/components/media/MediaGrid.tsx")

    expect(source).toContain("useStatusFeedback")
    expect(source).toContain('const statusId = status.loading(t("deleting"))')
    expect(source).toContain('status.success(t("deleted"), { id: statusId })')
    expect(source).toContain('status.error(err instanceof Error ? err.message : t("deleteFailed"), { id: statusId })')
    expect(source).toContain('status.success(t("deletedCount", { count: okCount }), { id: statusId })')
    expect(source).toContain('status.error(t("deletedPartial", { ok: okCount, failed: failCount }), { id: statusId })')
    expect(source).not.toContain(legacyImport)
    expect(source).not.toContain(legacyCall)
  })
})
