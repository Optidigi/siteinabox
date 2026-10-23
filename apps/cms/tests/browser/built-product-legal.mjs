import assert from "node:assert/strict"

export async function runProductLegalJourney({ newContext, login, cmsOrigin, fixture, control, verify, api }) {
  const context = await newContext("governed-product-legal")
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  await page.goto(cmsOrigin + "/login")
  const manifest = async (current = page) => {
    const response = await api(current, "/api/legal/product-manifest")
    assert.equal(response.status, 200); return response.data.documents
  }
  assert.equal((await manifest()).some(doc => doc.documentVersion === "2026-10-23.1"), false)
  const operator = fixture.roles.find(user => user.role === "super-admin")
  await login(page, operator, "/legal/product-drafts/product-2026-10-23.1")
  await page.getByRole("status").filter({ hasText: "Current state: draft" }).waitFor()
  assert.equal(await page.locator('section[lang="nl"]').count(), 2)
  assert.equal(await page.locator('section[lang="en"]').count(), 2)
  assert.equal(await page.getByRole("button", { name: "Record review / Beoordeling vastleggen", exact: true }).isDisabled(), true)
  assert.equal(await page.getByRole("button", { name: "Activate / Activeren", exact: true }).isDisabled(), true)
  verify("actual NL/EN source draft renders privately with review and activation blocked")
  control("review")
  assert.equal((await manifest()).some(doc => doc.documentVersion === "2026-10-23.99"), false)
  const publicContext = await newContext("public-product-policies"), publicPage = await publicContext.newPage()
  const href = locale => cmsOrigin + `/policies/${locale}/platform-terms/2026-10-23.99`
  await publicPage.goto(href("en"))
  assert.equal((await publicPage.locator("body").innerText()).includes("Synthetic M17 platform-terms en"), false)
  verify("review-only stored copies remain absent from public manifest and document output")
  control("activate")
  const records = (await manifest(publicPage)).filter(doc => doc.documentVersion === "2026-10-23.99")
  assert.equal(records.length, 4)
  for (const locale of ["nl", "en"]) for (const type of ["platform-terms", "platform-privacy"]) {
    await publicPage.goto(cmsOrigin + `/policies/${locale}/${type}/2026-10-23.99`)
    await publicPage.locator(`main[lang="${locale}"] article`).getByText(`Synthetic M17 ${type} ${locale}`, { exact: true }).waitFor()
    const record = records.find(doc => doc.locale === locale && doc.documentType === type)
    assert(record); assert.equal(await publicPage.getByText(new RegExp(record.contentHash)).count(), 1)
  }
  await publicPage.goto(href("fr"))
  assert.equal((await publicPage.locator("body").innerText()).includes("Synthetic M17"), false)
  verify("separately activated disposable NL/EN terms/privacy expose exact immutable locale/version/hash; other locales deny")
}
