import { isDeepStrictEqual } from "node:util"
import { readImageArchiveIdentity, assertLoadedImageIdentity } from "./image-archive-identity.mjs"
import { execFileSync } from "node:child_process"
import { writeFile } from "node:fs/promises"
import { checkPublication } from "./check-publication.mjs"

const { request, evidence, dependencyReadiness } = await checkPublication()
const docker = (args) => execFileSync("docker", args, { encoding: "utf8" })
const identity = readImageArchiveIdentity({ archive: "artifacts/image-" + request.image + ".tar", tag: evidence.tag, sourceSHA: request.sha })
if (!isDeepStrictEqual(identity, evidence.archiveIdentity)) throw new Error("Publication archive identity differs from verified bytes")
docker(["load", "--input", "artifacts/image-" + request.image + ".tar"])
const loaded = JSON.parse(docker(["image", "inspect", evidence.tag]))[0]
assertLoadedImageIdentity(identity, loaded)
const repository = "ghcr.io/" + process.env.GITHUB_REPOSITORY.toLowerCase() + "-" + request.image
const tag = repository + ":sha-" + request.sha
docker(["tag", evidence.tag, tag])
execFileSync("docker", ["push", tag], { stdio: "inherit" })
const digests = JSON.parse(docker(["image", "inspect", "--format", "{{json .RepoDigests}}", tag]))
const digest = digests.find((value) => value.startsWith(repository + "@sha256:"))
if (!digest || !/^sha256:[a-f0-9]{64}$/.test(digest.split("@")[1])) throw new Error("Published immutable digest was not recorded")
await writeFile("artifacts/published-" + request.image + ".json", JSON.stringify({ ...evidence,
  dependencyReadiness, publishedImageId: loaded.Id, published: true, registryDigest: digest, publicationRunId: process.env.GITHUB_RUN_ID }, null, 2) + "\n")
console.log("Published verified image: " + digest)
