import assert from "node:assert/strict"
import { test } from "node:test"
import { postgresRehearsalReady } from "./postgres-readiness.mjs"

test("rehearsal readiness requires the final TCP server and an actual target-database query", () => {
  let initialized = false
  const execute = (command,args,options) => {
    assert.equal(command,"docker")
    assert.equal(args[args.indexOf("-h")+1],"127.0.0.1","temporary socket-only entrypoint server must not satisfy readiness")
    assert.equal(args[args.indexOf("-d")+1],"payload_test")
    assert.equal(args.at(-1),"SELECT current_database()")
    assert(args.includes("ON_ERROR_STOP=1"));assert(options.timeout<=10_000)
    return initialized ? {status:0,stdout:"payload_test\n"} : {status:2,stdout:"",stderr:'database "payload_test" does not exist'}
  }
  assert.equal(postgresRehearsalReady("owned-db",execute),false)
  initialized=true
  assert.equal(postgresRehearsalReady("owned-db",execute),true)
})

test("server acceptance, another database, authentication errors and timeouts are not ready", () => {
  for(const result of [{status:0,stdout:"postgres\n"},{status:0,stdout:""},{status:2,stdout:"payload_test"},{status:null,error:new Error("timeout"),stdout:""}]) {
    assert.equal(postgresRehearsalReady("owned-db",()=>result),false)
  }
})
