/** One analyzer contract for collection, retained-byte rescanning and admission. */
export function requiredImageAnalysisTypes(application) {
  const types = { cms: ["alpine", "node-pkg"], renderer: ["alpine", "node-pkg"],
    site: ["alpine"], "cms-postgres": ["alpine"], "cms-cloudflared": ["gobinary"] }[application]
  if (!types) throw new Error("Unknown dependency image application")
  return types
}

export const scannerPin = {
  version: "0.76.0",
  archiveSha256: "e24b1c51293c1b15e4ba8d45bbc7891ba053f90278ec2698f3562c993e145fe7",
  binarySha256: "1f889576636db0623539cb339df7d06c40ebf39e7919489eafa1160e29808f19",
}
const text = (value) => typeof value === "string" && value.trim().length > 0
const hash = (value) => /^[a-f0-9]{64}$/.test(value ?? "")
const time = (value) => Date.parse(value)
const day = 24 * 60 * 60 * 1000

export class NativeAnalysisIncompleteError extends Error {
  constructor(inventory, missingTargets, missingTypes) {
    super("Native Go binary is present but analyzer coverage is missing; release evidence is incomplete")
    this.name = "NativeAnalysisIncompleteError"
    this.code = "NATIVE_ANALYSIS_INCOMPLETE"
    this.inventory = inventory
    this.missingTargets = missingTargets
    this.missingTypes = missingTypes
  }
}

/** Validate collected inventory, not advisory disposition or release clearance. */
export function validateImageInventory({ image, report, scanner, requiredTypes, requiredTargets = [], now = Date.now() }) {
  const database = scanner?.database
  if (scanner?.version !== scannerPin.version || scanner.archiveSha256 !== scannerPin.archiveSha256 || scanner.binarySha256 !== scannerPin.binarySha256 ||
      !hash(scanner.databaseSha256) || !hash(scanner.metadataSha256) || database?.Version !== 2 ||
      !Number.isFinite(now) || ![database.UpdatedAt, database.NextUpdate, database.DownloadedAt].every((value) => Number.isFinite(time(value))) ||
      time(database.UpdatedAt) > now + 300000 || now - time(database.UpdatedAt) > day ||
      time(database.NextUpdate) <= now || time(database.NextUpdate) <= time(database.UpdatedAt) ||
      time(database.DownloadedAt) < time(database.UpdatedAt) || time(database.DownloadedAt) > now + 300000) {
    throw new Error("Scanner/database identity or freshness evidence is missing, stale or inconsistent")
  }
  if (report?.SchemaVersion !== 2 || report.Trivy?.Version !== scannerPin.version || report.ArtifactType !== "container_image" ||
      !/^sha256:[a-f0-9]{64}$/.test(image?.imageId ?? "") || report.Metadata?.ImageID !== image.imageId ||
      !Number.isFinite(time(report.CreatedAt)) || time(report.CreatedAt) > now + 300000 || now - time(report.CreatedAt) > day ||
      time(report.CreatedAt) < time(database.UpdatedAt) || report.Metadata.ImageConfig?.os !== "linux" || report.Metadata.ImageConfig?.architecture !== image.runtimePlatform?.architecture ||
      report.Metadata.OS?.Family !== image.runtimePlatform?.os || report.Metadata.OS?.Name !== image.runtimePlatform?.version) {
    throw new Error("Image scan is incomplete or differs from the exact image, platform, OS or current scan time")
  }
  if (image.sourceSHA && (!/^[a-f0-9]{40}$/.test(image.sourceSHA) ||
      report.Metadata.ImageConfig?.config?.Labels?.["org.opencontainers.image.revision"] !== image.sourceSHA)) {
    throw new Error("Image scan source revision does not match verified source")
  }
  if (!Array.isArray(report.Results) || !Array.isArray(requiredTypes) || !requiredTypes.length ||
      !Array.isArray(requiredTargets) || requiredTargets.some((target) => !text(target))) {
    throw new Error("Image package inventory is missing required analysis coverage")
  }
  const missingTypes = requiredTypes.filter((type) => !report.Results.some((result) => result.Type === type && result.Packages?.length))
  if (missingTypes.some((type) => type !== "gobinary") || (!report.Results.length && !requiredTargets.length)) {
    throw new Error("Image package inventory is missing required analysis coverage")
  }
  const findings = []
  const unversionedPackages = []
  let packages = 0
  for (const result of report.Results) {
    if (!["os-pkgs", "lang-pkgs"].includes(result.Class) || !text(result.Type) || !text(result.Target) ||
        !Array.isArray(result.Packages) || !result.Packages.length ||
        (result.Vulnerabilities !== undefined && !Array.isArray(result.Vulnerabilities))) {
      throw new Error("Image analysis result is incomplete or unsupported")
    }
    for (const item of result.Packages) {
      if (!text(item?.Name) || !text(item.Identifier?.PURL)) throw new Error("Image package identity is incomplete")
      packages += 1
      if (!text(item.Version)) unversionedPackages.push({ name: item.Name, purl: item.Identifier.PURL, target: result.Target })
    }
    for (const finding of result.Vulnerabilities ?? []) {
      const severity = finding?.Severity?.toLowerCase()
      const goSource = /^GO-\d{4}-\d{4,}$/.test(finding?.VulnerabilityID ?? "") && finding.DataSource?.ID === "govulndb"
        ? "https://pkg.go.dev/vuln/" + finding.VulnerabilityID : null
      // Trivy may omit PrimaryURL for Go-only advisories. Require the exact
      // canonical advisory reference rather than inventing a source or dropping it.
      const source = text(finding?.PrimaryURL) ? finding.PrimaryURL :
        goSource && Array.isArray(finding.References) && finding.References.includes(goSource) ? goSource : null
      if (!text(finding?.VulnerabilityID) || !text(finding.PkgName) ||
          (finding.PrimaryURL != null && typeof finding.PrimaryURL !== "string") ||
          (finding.References !== undefined && !Array.isArray(finding.References)) ||
          !["unknown", "low", "medium", "high", "critical"].includes(severity)) {
        throw new Error("Image vulnerability evidence is malformed or has unknown schema")
      }
      findings.push({ id: finding.VulnerabilityID, package: finding.PkgName, version: finding.InstalledVersion || "(not-recorded)",
        severity, fixedVersion: finding.FixedVersion ?? null, source, sourceStatus: source ? "recorded" : "unresolved",
        type: result.Type, target: result.Class === "os-pkgs" ? "os-packages" : result.Target,
        paths: [finding.PkgPath || (result.Class === "os-pkgs" ? "os-packages" : result.Target)],
        purl: finding.PkgIdentifier?.PURL ?? null, dataSource: finding.DataSource ?? null,
        severitySource: finding.SeveritySource ?? null, vendorSeverity: finding.VendorSeverity ?? null,
        references: finding.References ?? [], modifiedAt: finding.LastModifiedDate ?? null })
    }
  }
  const inventory = { packages, findings, unversionedPackages, scannerVersion: scanner.version, imageId: image.imageId }
  const missingTargets = requiredTargets.filter((target) => !report.Results.some((result) => result.Type === "gobinary" && result.Target === target && result.Packages?.length))
  if (missingTargets.length || missingTypes.length) throw new NativeAnalysisIncompleteError(inventory, missingTargets, missingTypes)
  return inventory
}
