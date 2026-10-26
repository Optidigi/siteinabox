import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { Payload } from "payload"
import { beginPartnerConnection, completePartnerConnection, decryptPartnerSecret, encryptPartnerSecret } from "../../src/lib/microsoftMailProvisioning/partnerConnection.ts"

const env: NodeJS.ProcessEnv = { NODE_ENV: "test", MICROSOFT_PARTNER_TENANT_ID: "00000000-0000-0000-0000-000000000001", MICROSOFT_PARTNER_APP_CLIENT_ID: "00000000-0000-0000-0000-000000000002",
  MICROSOFT_PARTNER_APP_CLIENT_SECRET: "synthetic-client-secret", MICROSOFT_PARTNER_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32,6).toString("base64"), MICROSOFT_PARTNER_APP_REDIRECT_URI: "https://admin.fixture.test/operations/microsoft-mail/consent/callback" }

describe("partner authorization admission", () => {
  it("binds encrypted tokens to the partner app and separates OAuth state from refresh credentials", () => {
    const token = encryptPartnerSecret("synthetic-refresh-token",env)
    assert.equal(decryptPartnerSecret(token,env),"synthetic-refresh-token")
    assert.throws(() => decryptPartnerSecret(token,{ ...env, MICROSOFT_PARTNER_APP_CLIENT_ID: "another-app" }))
    assert.throws(() => decryptPartnerSecret(token,env,"handshake"))
    const start = beginPartnerConnection("7",env)
    const url = new URL(start.url)
    assert.equal(url.searchParams.get("code_challenge_method"),"S256")
    assert.equal(url.searchParams.get("redirect_uri"),env.MICROSOFT_PARTNER_APP_REDIRECT_URI)
    assert.equal(JSON.parse(decryptPartnerSecret(start.cookie,env,"handshake")).actorId,"7")
  })
  it("rejects another operator or state before any OAuth or database call", async t => {
    const start=beginPartnerConnection("7",env)
    const state=new URL(start.url).searchParams.get("state")!
    const fetchMock=t.mock.method(globalThis,"fetch",async()=>{throw new Error("Unexpected OAuth call")})
    await assert.rejects(completePartnerConnection({payload:{} as Payload,code:"synthetic-code",state,cookie:start.cookie,actorId:"8",env}),/state/)
    await assert.rejects(completePartnerConnection({payload:{} as Payload,code:"synthetic-code",state:"different",cookie:start.cookie,actorId:"7",env}),/state/)
    assert.equal(fetchMock.mock.callCount(),0)
  })
  it("does not accept an unsigned identity token even with matching state, issuer, app and nonce", async t => {
    const start=beginPartnerConnection("7",env)
    const state=new URL(start.url).searchParams.get("state")!
    const h=JSON.parse(decryptPartnerSecret(start.cookie,env,"handshake"))
    const encoded=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString("base64url")
    const token=`${encoded({alg:"none"})}.${encoded({iss:`https://login.microsoftonline.com/${env.MICROSOFT_PARTNER_TENANT_ID}/v2.0`,aud:env.MICROSOFT_PARTNER_APP_CLIENT_ID,tid:env.MICROSOFT_PARTNER_TENANT_ID,nonce:h.nonce,oid:"synthetic-user",preferred_username:"operator@fixture.test",exp:Math.floor(Date.now()/1000)+600})}.`
    const fetchMock=t.mock.method(globalThis,"fetch",async()=>Response.json({id_token:token,refresh_token:"synthetic-refresh-token"}))
    await assert.rejects(completePartnerConnection({payload:{} as Payload,code:"synthetic-code",state,cookie:start.cookie,actorId:"7",env}))
    assert.equal(fetchMock.mock.callCount(),1)
  })
})
