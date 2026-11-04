import { readFile } from "node:fs/promises"
import { resolve, sep } from "node:path"
const unescape = (value) =>
  value.replace(/\\([0-7]{3})/g, (_, digits) =>
    String.fromCharCode(parseInt(digits, 8)),
  )

/** Refuse a missing off-host mount; never acknowledge checkpoints on its local fallback directory. */
export async function assertRecoveryMount(
  root,
  expected,
  { readMountInfo = () => readFile("/proc/self/mountinfo", "utf8") } = {},
) {
  if (
    !expected ||
    !["nfs", "nfs4", "cifs", "fuse.sshfs"].includes(expected.fileSystem) ||
    typeof expected.source !== "string" ||
    !expected.source ||
    /^(localhost|127\.|\[?::1)/i.test(expected.source) ||
    typeof expected.mountPoint !== "string" ||
    expected.mountPoint === "/" ||
    resolve(expected.mountPoint) !== expected.mountPoint
  )
    throw Error("WORKER_RECOVERY_MOUNT_INVALID")
  root = resolve(root)
  if (
    root !== expected.mountPoint &&
    !root.startsWith(expected.mountPoint + sep)
  )
    throw Error("WORKER_RECOVERY_MOUNT_INVALID")
  const mounts = (await readMountInfo())
    .trim()
    .split("\n")
    .map((line) => {
      const [before, after] = line.split(" - ")
      if (!before || !after) return null
      const left = before.split(" "),
        right = after.split(" ")
      return {
        mountPoint: unescape(left[4]),
        fileSystem: right[0],
        source: unescape(right[1]),
      }
    })
    .filter(Boolean)
    .filter(
      (mount) =>
        root === mount.mountPoint || root.startsWith(mount.mountPoint + sep),
    )
    .sort((a, b) => b.mountPoint.length - a.mountPoint.length)
  const actual = mounts[0]
  if (
    !actual ||
    actual.mountPoint !== expected.mountPoint ||
    actual.fileSystem !== expected.fileSystem ||
    actual.source !== expected.source
  )
    throw Error("WORKER_RECOVERY_MOUNT_UNAVAILABLE")
  return actual
}
