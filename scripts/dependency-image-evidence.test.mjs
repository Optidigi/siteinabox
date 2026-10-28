import { validateScannerDiagnostics } from "./scan-image-dependencies.mjs"
import test from "node:test"
import assert from "node:assert/strict"
import { validateImageInventory, imageInventoryStatus } from "./dependency-image-evidence.mjs"

const now = Date.parse("2026-10-21T00:00:00Z")
const sha = "a".repeat(40)
const hash = "b".repeat(64)
const fixture = () => ({ now,
  image: { imageId: "sha256:" + hash, sourceSHA: sha, runtimePlatform: { os: "alpine", version: "3.24.2", architecture: "amd64" } },
  scanner: { version: "0.76.0", archiveSha256: "e24b1c51293c1b15e4ba8d45bbc7891ba053f90278ec2698f3562c993e145fe7", binarySha256: "1f889576636db0623539cb339df7d06c40ebf39e7919489eafa1160e29808f19", databaseSha256: hash, metadataSha256: hash,
    database: { Version: 2, UpdatedAt: "2026-10-20T19:00:00Z", NextUpdate: "2026-10-21T19:00:00Z", DownloadedAt: "2026-10-20T23:00:00Z" } },
  report: { SchemaVersion: 2, Trivy: { Version: "0.76.0" }, CreatedAt: "2026-10-20T23:00:00Z", ArtifactType: "container_image", Metadata: { ImageID: "sha256:" + hash, OS: { Family: "alpine", Name: "3.24.2" }, ImageConfig: { os: "linux", architecture: "amd64", config: { Labels: { "org.opencontainers.image.revision": sha } } } },
    Results: [{ Target: "fixture", Class: "os-pkgs", Type: "alpine", Packages: [{ Name: "zlib", Version: "1.3.2-r0", Identifier: { PURL: "pkg:apk/alpine/zlib@1.3.2-r0" } }], Vulnerabilities: [{ VulnerabilityID: "CVE-fixture", PkgName: "zlib", InstalledVersion: "1.3.2-r0", Severity: "HIGH", PrimaryURL: "https://example.test/advisory" }] }] },
  requiredTypes: ["alpine"],
})
test("complete exact-image inventory retains every finding without declaring it safe", () => {
  const result = validateImageInventory(fixture())
  assert.equal(result.packages, 1); assert.equal(result.findings.length, 1)
  assert.equal(result.findings[0].id, "CVE-fixture")
})
test("source, image, OS and platform mismatches fail", () => {
  for (const mutate of [
    (x) => { x.report.Metadata.ImageID = "sha256:" + "c".repeat(64) },
    (x) => { x.report.Metadata.ImageConfig.config.Labels["org.opencontainers.image.revision"] = "c".repeat(40) },
    (x) => { x.report.Metadata.OS.Name = "3.23.0" },
    (x) => { x.report.Metadata.ImageConfig.architecture = "arm64" },
  ]) { const x = fixture(); mutate(x); assert.throws(() => validateImageInventory(x)) }
})
test("missing packages/results are incomplete even when no vulnerabilities are reported", () => {
  for (const mutate of [
    (x) => { delete x.report.Results }, (x) => { x.report.Results = [] },
    (x) => { x.report.Results[0].Packages = [] }, (x) => { delete x.report.Metadata.OS },
    (x) => { x.requiredTypes.push("node-pkg") }, (x) => { x.report.SchemaVersion = 999 },
  ]) { const x = fixture(); mutate(x); assert.throws(() => validateImageInventory(x)) }
})
test("stale, future or inconsistent databases and reports fail", () => {
  for (const mutate of [
    (x) => { x.scanner.database.UpdatedAt = "2026-10-18T00:00:00Z" },
    (x) => { x.scanner.database.NextUpdate = "2026-10-20T00:00:00Z" },
    (x) => { x.scanner.database.DownloadedAt = "2026-10-22T00:00:00Z" },
    (x) => { x.report.CreatedAt = "2026-10-22T00:00:00Z" },
    (x) => { x.scanner.databaseSha256 = null },
    (x) => { x.scanner.version = "0.75.0" },
  ]) { const x = fixture(); mutate(x); assert.throws(() => validateImageInventory(x)) }
})
test("unknown severity is retained as a blocker, never silently filtered", () => {
  const x = fixture(); x.report.Results[0].Vulnerabilities[0].Severity = "UNKNOWN"
  assert.equal(validateImageInventory(x).findings[0].severity, "unknown")
  x.report.Results[0].Vulnerabilities[0].Severity = "unrecognized"
  assert.throws(() => validateImageInventory(x))
})

test("a native executable missed by the scanner cannot become a clean empty result", () => {
  const x = fixture(); x.requiredTargets = ["app/esbuild"]
  assert.throws(() => validateImageInventory(x), /Native Go binary.*coverage/)
})

test("documented severity provenance notice is retained but unknown warnings and errors block", async () => {
  const { validateScannerDiagnostics } = await import("./scan-image-dependencies.mjs")
  const notice = "2026-10-21T01:15:00Z\tWARN\tUsing severities from other vendors for some vulnerabilities. Read https://trivy.dev/docs/v0.76/guide/scanner/vulnerability#severity-selection for details."
  assert.deepEqual(validateScannerDiagnostics(notice).map((item) => item.code), ["VENDOR_SEVERITY_FALLBACK"])
  for (const bad of [notice + " extra", notice.replace("v0.76/", "v0.77/"),
    "2026-10-21T01:15:00Z\tWARN\tFailed to analyze a binary", notice + "\n2026-10-21T01:15:00Z\tERROR\tIncomplete scan"]) {
    assert.throws(() => validateScannerDiagnostics(bad), /completeness requires review/)
  }
})

test("Go database findings without PrimaryURL retain canonical advisory source and UNKNOWN severity", () => {
  const input = fixture()
  const finding = input.report.Results[0].Vulnerabilities[0]
  delete finding.PrimaryURL
  Object.assign(finding, { VulnerabilityID: "GO-2026-5932", Severity: "UNKNOWN",
    DataSource: { ID: "govulndb", URL: "https://pkg.go.dev/vuln/" }, References: ["https://pkg.go.dev/vuln/GO-2026-5932"] })
  const inventory = validateImageInventory(input)
  assert.equal(inventory.findings[0].source, "https://pkg.go.dev/vuln/GO-2026-5932")
  assert.equal(inventory.findings[0].severity, "unknown")
  finding.References = ["https://example.test/not-the-advisory"]
  assert.equal(validateImageInventory(input).findings[0].sourceStatus, "unresolved")
  assert.equal(imageInventoryStatus(validateImageInventory(input), null), "incomplete")
  finding.PrimaryURL = 123
  assert.throws(() => validateImageInventory(input), /malformed|unknown schema/)
})

test("missing advisory details require matching unresolved UNKNOWN findings", async () => {
  const { validateScannerDiagnostics } = await import("./scan-image-dependencies.mjs")
  const input = fixture()
  const finding = input.report.Results[0].Vulnerabilities[0]
  Object.assign(finding, { VulnerabilityID: "CVE-2026-107891", PkgName: "musl", Severity: "UNKNOWN",
    DataSource: { ID: "alpine", URL: "https://secdb.alpinelinux.org/" }, References: [] })
  delete finding.PrimaryURL
  delete finding.Title
  delete finding.Description
  const diagnostic = '2026-10-22T19:14:00Z\tWARN\tUnable to get vulnerability details (CVE may be rejected)\terr.message="failed to get vulnerability" err.err="failed to get vulnerability: no vulnerability details" err.context.vuln_id="CVE-2026-107891"'
  assert.equal(validateScannerDiagnostics(diagnostic, input.report)[0].code, "ADVISORY_DETAILS_UNAVAILABLE")
  assert.equal(validateImageInventory(input).findings[0].sourceStatus, "unresolved")
  for (const report of [undefined, { Results: [] }, structuredClone(input.report)]) {
    if (report?.Results?.length) report.Results[0].Vulnerabilities[0].Severity = "HIGH"
    assert.throws(() => validateScannerDiagnostics(diagnostic, report), /completeness requires review/)
  }
  finding.PrimaryURL = "https://example.test/recorded-advisory"
  assert.throws(() => validateScannerDiagnostics(diagnostic, input.report), /completeness requires review/)
  delete finding.PrimaryURL
  assert.throws(() => validateScannerDiagnostics(diagnostic.replace('107891"', '107892"'), input.report), /completeness requires review/)
  assert.throws(() => validateScannerDiagnostics(diagnostic + '\n2026-10-22T19:14:00Z\tWARN\tFailed to analyze a binary', input.report), /completeness requires review/)
})

test("an advisory with unresolved source metadata remains explicit blocked evidence", () => {
  const input = fixture()
  const finding = input.report.Results[0].Vulnerabilities[0]
  delete finding.PrimaryURL
  Object.assign(finding, { VulnerabilityID: "DSA-6572-1", PkgName: "ca-certificates", Severity: "UNKNOWN",
    DataSource: { ID: "debian", Name: "Debian Security Tracker", URL: "https://salsa.debian.org/security-tracker-team/security-tracker" }, References: [] })
  const inventory = validateImageInventory(input)
  assert.equal(inventory.findings.length, 1)
  assert.equal(inventory.findings[0].id, "DSA-6572-1")
  assert.equal(inventory.findings[0].source, null)
  assert.equal(inventory.findings[0].sourceStatus, "unresolved")
  assert.equal(inventory.findings[0].severity, "unknown")
})

test("the exact vendor notice supports ISO timezone offsets without accepting unknown warnings", () => {
  const message = "Using severities from other vendors for some vulnerabilities. Read https://trivy.dev/docs/v0.76/guide/scanner/vulnerability#severity-selection for details."
  for (const offset of ["+01:00", "-05:00", "+00:00"]) {
    const line = "2026-10-28T14:18:46" + offset + "\tWARN\t" + message
    assert.equal(validateScannerDiagnostics(line, {}).length, 1)
    assert.throws(() => validateScannerDiagnostics(line.replace(message, "Failed to analyze a binary"), {}))
  }
})
