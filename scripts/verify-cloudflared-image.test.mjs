import assert from "node:assert/strict"
import test from "node:test"
import { spawn, spawnSync } from "node:child_process"
import { readTunnelDiagnostics } from "./verify-cloudflared-image.mjs"

const fixture = (program, children) => (command, args) => {
  assert.equal(command, "docker")
  assert.deepEqual(args, ["logs", "owned-tunnel"])
  const child = spawn(process.execPath, ["-e", program], { stdio: ["ignore", "pipe", "pipe"] })
  children.push(child)
  return child
}

test("startup is detected in a log backlog larger than the synchronous capture limit", async () => {
  const program = `process.stderr.write('Starting metrics server\\n'); process.stderr.write('x'.repeat(4*1024*1024)); setTimeout(()=>{},1000)`
  const legacy = spawnSync(process.execPath, ["-e", program], { encoding: "utf8", timeout: 5000 })
  assert.equal(legacy.error?.code, "ENOBUFS")
  const children = []
  const result = await readTunnelDiagnostics("owned-tunnel", { spawnImpl: fixture(program, children), timeoutMs: 5000 })
  assert.equal(result.metricsStarted, true)
  assert.ok(result.tail.length <= 2048)
  assert.ok(children.every(child => child.exitCode !== null || child.signalCode !== null))
})

test("marker can cross chunks and either stream while diagnostics remain bounded", async () => {
  for (const channel of ["stdout", "stderr"]) {
    const children = []
    const result = await readTunnelDiagnostics("owned-tunnel", {
      spawnImpl: fixture(`process.${channel}.write('Starting met'); setTimeout(()=>process.${channel}.write('rics server\\n'),20)`, children),
      timeoutMs: 5000,
    })
    assert.equal(result.metricsStarted, true)
  }
  const result = await readTunnelDiagnostics("owned-tunnel", {
    spawnImpl: fixture(`process.stderr.write('x'.repeat(4*1024*1024))`, []), timeoutMs: 5000,
  })
  assert.equal(result.metricsStarted, false)
  assert.equal(result.tail.length, 2048)
})

test("transport failure and deadline reject instead of inventing startup", async () => {
  await assert.rejects(readTunnelDiagnostics("owned-tunnel", {
    spawnImpl: fixture(`process.stderr.write('docker read failed'); process.exit(1)`, []), timeoutMs: 5000,
  }), /diagnostics/)
  const children = []
  await assert.rejects(readTunnelDiagnostics("owned-tunnel", {
    spawnImpl: fixture(`setTimeout(()=>{},1000)`, children), timeoutMs: 100,
  }), /deadline/)
  assert.ok(children.every(child => child.killed))
  await assert.rejects(readTunnelDiagnostics("owned-tunnel", {
    spawnImpl: () => spawn("/nonexistent/siab-docker-diagnostic"), timeoutMs: 1000,
  }), /ENOENT/)
})

test("Docker-style cancellation exit after the owned reader is stopped retains startup proof", async () => {
  const children=[]
  const result=await readTunnelDiagnostics("owned-tunnel", {
    spawnImpl:fixture(`process.on('SIGTERM',()=>{process.stderr.write('http: read on closed response body');process.exit(1)});process.stderr.write('Starting metrics server\\n');setTimeout(()=>{},1000)`,children),
    timeoutMs:5000,
  })
  assert.equal(result.metricsStarted,true)
  assert.equal(children[0].exitCode,1)
})
