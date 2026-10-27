import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtemp, mkdir, writeFile, symlink, rm, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { prepareImageBuildCache } from "./image-build-cache.mjs"

test("cold and malformed caches are misses; OCI exporter bytes can replace only the scoped cache", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "siab-buildkit-"))
  try {
    let cache = await prepareImageBuildCache(root,"cms")
    assert.equal(cache.arguments.includes("--cache-from"),false)
    await mkdir(path.join(root,"artifacts/buildkit-cache/cms.next"))
    await writeFile(path.join(root,"artifacts/buildkit-cache/cms.next/index.json"),JSON.stringify({schemaVersion:2,manifests:[{digest:"sha256:"+"a".repeat(64)}]}))
    await cache.commit()
    cache = await prepareImageBuildCache(root,"cms")
    assert.equal(cache.arguments.includes("--cache-from"),true)
    await writeFile(path.join(root,"artifacts/buildkit-cache/cms/index.json"),"malformed")
    cache = await prepareImageBuildCache(root,"cms")
    assert.equal(cache.arguments.includes("--cache-from"),false)
    await assert.rejects(cache.commit(),/OCI cache index/)
    assert.equal(await readFile(path.join(root,"artifacts/buildkit-cache/cms/index.json"),"utf8"),"malformed")
  } finally { await rm(root,{recursive:true}) }
})

test("cache setup refuses symlinks and arbitrary image scopes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "siab-buildkit-"))
  try {
    await mkdir(path.join(root,"artifacts/buildkit-cache"),{recursive:true})
    await symlink(tmpdir(),path.join(root,"artifacts/buildkit-cache/cms"))
    await assert.rejects(prepareImageBuildCache(root,"cms"),/unsafe/)
    await assert.rejects(prepareImageBuildCache(root,"../../outside"),/Unknown/)
  } finally { await rm(root,{recursive:true}) }
})

test("CI cache and archive roots cannot enter application build contexts", async () => {
  const ignore = await readFile(new URL("../.dockerignore", import.meta.url),"utf8")
  assert(ignore.split(/\r?\n/).includes("artifacts"))
})
