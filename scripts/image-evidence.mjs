export const imageApplications = ["cms", "renderer", "site"]

export function assertImageVerificationEvidence({ sha, runId, attempt, image }, evidence) {
  if (!/^[a-f0-9]{40}$/.test(sha ?? "") || !/^[1-9][0-9]*$/.test(runId ?? "") ||
      !/^[1-9][0-9]*$/.test(attempt ?? "") || !imageApplications.includes(image) ||
      evidence?.application !== image || evidence.sourceSHA !== sha ||
      evidence.verificationRunId !== runId || evidence.verificationRunAttempt !== attempt ||
      !new RegExp("^siab-verify-[a-f0-9]{8}-" + sha + ":" + image + "$").test(evidence.tag ?? "") ||
      !/^sha256:[a-f0-9]{64}$/.test(evidence.imageId ?? "") ||
      !/^[a-f0-9]{64}$/.test(evidence.archiveSha256 ?? "") ||
      !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(evidence.nodeVersion ?? "") ||
      typeof evidence.buildNodeLts !== "string" || !evidence.buildNodeLts.trim() ||
      (image === "site" ? evidence.nodeLts !== null : evidence.nodeLts !== evidence.buildNodeLts) ||
      evidence.packagedSmoke !== "passed" || evidence.published !== false || typeof evidence.publishable !== "boolean") {
    throw new Error("Image verification evidence is missing or mismatches source, run, attempt, image or successful packaged smoke")
  }
}
