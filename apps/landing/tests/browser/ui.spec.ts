import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js",
    (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `
      (() => {
        const token = 'XXXX.DUMMY.TOKEN.XXXX';
        const issueToken = () => {
          document.querySelectorAll('.cf-turnstile').forEach((widget) => {
            let input = widget.querySelector('[name="cf-turnstile-response"]');
            if (!input) {
              input = document.createElement('input');
              input.type = 'hidden';
              input.name = 'cf-turnstile-response';
              widget.append(input);
            }
            input.value = token;
          });
        };
        window.turnstile = { reset: issueToken };
        issueToken();
      })();
    `,
      }),
  );
});

async function setTheme(
  page: import("playwright/test").Page,
  theme: "light" | "dark",
) {
  await page.addInitScript(
    (value) => localStorage.setItem("siab-theme", value),
    theme,
  );
}

async function waitForIsland(locator: import("playwright/test").Locator) {
  const island = locator.locator("xpath=ancestor::astro-island");
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute("ssr", "");
}

test.describe("landing visual smoke contract", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`homepage ${theme} desktop`, async ({ page }) => {
      await setTheme(page, theme);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "Een website voor je bedrijf",
      );
      await expect(
        page.getByRole("heading", { name: "Zo werkt het.", level: 2 }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Onze klanten", level: 2 }),
      ).toBeVisible();
      await expect(page.locator("footer")).toBeVisible();
      const header = page.locator("[data-site-header]");
      await expect(header).toHaveAttribute("data-hero", "");
      await expect(header).not.toHaveAttribute("data-scrolled", "");
      const initialHeaderBackground = await header.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      );
      await page.evaluate(() => window.scrollTo(0, 240));
      await expect(header).toHaveAttribute("data-scrolled", "");
      if (theme === "light") {
        expect(
          await header.evaluate(
            (element) => getComputedStyle(element).backgroundColor,
          ),
        ).not.toBe(initialHeaderBackground);
      }
      expect(
        await page.evaluate(
          () =>
            document.body.scrollWidth > document.documentElement.clientWidth,
        ),
      ).toBe(false);
    });

    test(`homepage ${theme} mobile`, async ({ page }) => {
      await setTheme(page, theme);
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto("/");
      const hasHorizontalOverflow = await page.evaluate(
        () => document.body.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasHorizontalOverflow).toBe(false);
      await expect(
        page.getByRole("heading", { name: "Zo werkt het.", level: 2 }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Veelgestelde vragen", level: 2 }),
      ).toBeVisible();
      await expect(page.locator("footer")).toBeVisible();
      const header = page.locator("[data-site-header]");
      await expect(header).toHaveAttribute("data-hero", "");
      await expect(header).not.toHaveAttribute("data-scrolled", "");
    });
  }
});

test("interactive controls remain accessible", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const menuTrigger = page.getByRole("button", { name: "Open navigatie" });
  await waitForIsland(menuTrigger);
  await menuTrigger.click();
  const mobileMenu = page.getByRole("dialog", { name: "Menu" });
  const menuClose = page.getByRole("button", { name: "Sluit navigatie" });
  await expect(mobileMenu).toBeVisible();
  await expect(menuClose).toBeVisible();
  const closeBounds = await menuClose.boundingBox();
  expect(closeBounds?.width).toBeGreaterThanOrEqual(44);
  expect(closeBounds?.height).toBeGreaterThanOrEqual(44);
  await menuClose.click();
  await expect(mobileMenu).toBeHidden();
  await menuTrigger.click();
  await page.keyboard.press("Escape");
  await expect(menuTrigger).toBeFocused();

  await page
    .getByRole("button", { name: "Thema: licht (klik voor donker)" })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  const reloadedThemeTrigger = page.getByRole("button", {
    name: "Thema: donker (klik voor licht)",
  });
  await waitForIsland(reloadedThemeTrigger);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const yearlySwitch = page.getByRole("switch", {
    name: "Jaarlijkse facturatie",
  });
  await waitForIsland(yearlySwitch);
  await yearlySwitch.click();
  await expect(yearlySwitch).toBeChecked();
  await expect(page.getByText("Je bespaart €38 per jaar")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.body.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);

  const tooltipTrigger = page.getByRole("button", {
    name: /Meer info: Homepage/,
  });
  await tooltipTrigger.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();

  const carousel = page.getByRole("region", { name: "Klantbeoordelingen" });
  await waitForIsland(carousel);
  const beforeTransform = await carousel
    .locator('[data-slot="carousel-content"] > div')
    .evaluate((element) => getComputedStyle(element).transform);
  await page.getByRole("button", { name: "Next slide" }).click();
  await expect
    .poll(async () =>
      carousel
        .locator('[data-slot="carousel-content"] > div')
        .evaluate((element) => getComputedStyle(element).transform),
    )
    .not.toBe(beforeTransform);
  await carousel.focus();
  const beforeKeyboardTransform = await carousel
    .locator('[data-slot="carousel-content"] > div')
    .evaluate((element) => getComputedStyle(element).transform);
  await page.keyboard.press("ArrowLeft");
  await expect
    .poll(async () =>
      carousel
        .locator('[data-slot="carousel-content"] > div')
        .evaluate((element) => getComputedStyle(element).transform),
    )
    .not.toBe(beforeKeyboardTransform);

  const question = page.getByRole("button", {
    name: "Hoe weten jullie wat er op mijn website moet komen?",
  });
  await waitForIsland(question);
  await question.click();
  await expect(question).toHaveAttribute("aria-expanded", "true");

  const marqueeDuration = await page
    .locator(".siab-marquee-track")
    .evaluate((element) => getComputedStyle(element).animationDuration);
  expect(marqueeDuration).not.toBe("0s");
  const marqueeGeometry = await page
    .locator(".siab-marquee-track")
    .evaluate((element) => {
      const groups = Array.from(
        element.querySelectorAll<HTMLElement>("[data-marquee-group]"),
      );
      return {
        groupWidths: groups.map((group) => group.getBoundingClientRect().width),
        trackWidth: element.getBoundingClientRect().width,
        trackMask: getComputedStyle(element).maskImage,
        viewportMask: getComputedStyle(element.parentElement!).maskImage,
        decorativeCopyHidden:
          element.parentElement?.getAttribute("aria-hidden"),
      };
    });
  expect(marqueeGeometry.groupWidths).toHaveLength(2);
  expect(
    Math.abs(marqueeGeometry.groupWidths[0] - marqueeGeometry.groupWidths[1]),
  ).toBeLessThan(0.1);
  expect(
    Math.abs(
      marqueeGeometry.trackWidth -
        marqueeGeometry.groupWidths[0] -
        marqueeGeometry.groupWidths[1],
    ),
  ).toBeLessThan(0.1);
  expect(marqueeGeometry.trackMask).toBe("none");
  expect(marqueeGeometry.viewportMask).not.toBe("none");
  expect(marqueeGeometry.decorativeCopyHidden).toBe("true");
  await expect(
    page.getByText("Voor deze beroepen werken wij:", { exact: false }),
  ).toHaveClass(/sr-only/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  const reducedDuration = await page
    .locator(".siab-marquee-track")
    .evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).animationDuration),
    );
  expect(reducedDuration).toBeLessThanOrEqual(0.001);
  expect(runtimeErrors).toEqual([]);
});

test("call and WhatsApp channels stay distinct and trackable", async ({
  page,
}) => {
  await page.goto("/");

  const footerCall = page.locator(
    'a[data-analytics-action="contact_phone"][data-analytics-placement="footer_help"]',
  );
  await expect(footerCall).toHaveAttribute("href", "tel:+31850835858");
  await expect(footerCall).toContainText("Bel ons gerust");
  await expect(footerCall).toContainText("085 083 5858");
  await expect(footerCall).toHaveAttribute(
    "data-analytics-destination",
    "phone",
  );
  await expect(footerCall).toHaveAttribute(
    "data-analytics-conversion-source",
    "contact_click",
  );

  const footerWhatsApp = page.locator(
    'a[data-analytics-action="contact_whatsapp"][data-analytics-placement="footer_help"]',
  );
  await expect(footerWhatsApp).toHaveAttribute(
    "href",
    "https://wa.me/31625052591",
  );
  await expect(footerWhatsApp).toContainText("Stuur ons een bericht");
  await expect(footerWhatsApp).not.toContainText("085 083 5858");
  await expect(footerWhatsApp).toHaveAttribute(
    "data-analytics-destination",
    "whatsapp",
  );
  await expect(footerWhatsApp).toHaveAttribute(
    "data-analytics-conversion-source",
    "contact_click",
  );

  await expect(page.locator("[data-consent-settings]")).toHaveCSS(
    "cursor",
    "pointer",
  );

  await page.goto("/contact");
  const contactCall = page.locator(
    'a[data-analytics-action="contact_phone"][data-analytics-placement="contact_page"]',
  );
  const contactWhatsApp = page.locator(
    'a[data-analytics-action="contact_whatsapp"][data-analytics-placement="contact_page"]',
  );
  await expect(contactCall).toHaveAttribute("href", "tel:+31850835858");
  await expect(contactCall).toContainText("085 083 5858");
  await expect(contactWhatsApp).toHaveAttribute(
    "href",
    "https://wa.me/31625052591",
  );
  await expect(contactWhatsApp).toContainText("Stuur ons een bericht");
  await expect(contactCall).toHaveAttribute(
    "data-analytics-conversion",
    "true",
  );
  await expect(contactWhatsApp).toHaveAttribute(
    "data-analytics-conversion",
    "true",
  );
});

test("compact header and process cards keep their responsive geometry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 644, height: 863 });
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Inloggen" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start gratis" })).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Open navigatie" }),
  ).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.body.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  const visualHeights = await page
    .locator("[data-process-visual]")
    .evaluateAll((elements) =>
      elements.map((element) =>
        Math.round(element.getBoundingClientRect().height),
      ),
    );
  expect(new Set(visualHeights).size).toBe(1);
});

test("desktop bento preserves the production clipping and process form containment", async ({
  page,
}) => {
  await setTheme(page, "dark");
  await page.setViewportSize({ width: 1247, height: 1324 });
  await page.goto("/");

  const formBox = await page.locator("[data-process-form]").boundingBox();
  const photosBox = await page.locator("[data-process-photos]").boundingBox();
  expect(formBox).not.toBeNull();
  expect(photosBox).not.toBeNull();
  expect(photosBox!.y + photosBox!.height).toBeLessThanOrEqual(
    formBox!.y + formBox!.height,
  );
  expect(
    await page
      .locator("[data-process-form]")
      .evaluate((element) => element.scrollHeight <= element.clientHeight),
  ).toBe(true);

  const safariScreen = page.locator("[data-device-safari-screen]");
  const phoneScreen = page.locator("[data-device-phone-screen]");
  await safariScreen.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      phoneScreen
        .locator("img")
        .evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
    )
    .toBe(true);
  await expect(safariScreen.locator("img")).toHaveCSS(
    "object-position",
    "50% 0%",
  );
  await expect(safariScreen).toHaveCSS("overflow", "hidden");
  await expect(phoneScreen).toHaveCSS("overflow", "hidden");
  expect(
    await phoneScreen.evaluate(
      (element) => getComputedStyle(element).borderRadius,
    ),
  ).not.toBe("0px");

  const deviceCard = page.locator("#zo-werkt-het article").nth(1);
  const phoneFrameBox = await page
    .locator("[data-device-phone-frame]")
    .boundingBox();
  const safariFrameBox = await page
    .locator("[data-device-safari-frame]")
    .boundingBox();
  const stackBox = await page.locator("[data-device-stack]").boundingBox();
  const cardBox = await deviceCard.boundingBox();
  expect(phoneFrameBox).not.toBeNull();
  expect(safariFrameBox).not.toBeNull();
  expect(stackBox).not.toBeNull();
  expect(cardBox).not.toBeNull();
  await expect(deviceCard).toHaveCSS("overflow", "hidden");
  await expect(page.locator("[data-device-stack]")).toHaveCSS(
    "margin-bottom",
    "-80px",
  );
  expect(
    await page
      .locator("[data-device-phone-frame]")
      .evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).bottom),
      ),
  ).toBeLessThan(0);
  expect(phoneFrameBox!.y + phoneFrameBox!.height).toBeGreaterThanOrEqual(
    cardBox!.y + cardBox!.height - 2,
  );
  expect(safariFrameBox!.y + safariFrameBox!.height).toBeGreaterThanOrEqual(
    cardBox!.y + cardBox!.height - 2,
  );

  const bentoType = await page
    .locator("#zo-werkt-het article h3")
    .evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).fontSize),
    );
  expect(bentoType).toEqual(["35px", "35px", "28px"]);
  await expect(page.locator("#zo-werkt-het blockquote")).toHaveCSS(
    "font-size",
    "28px",
  );
  await expect(
    page.locator("#zo-werkt-het article").first().locator("svg"),
  ).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(
    page.locator("#zo-werkt-het article").last().locator("svg"),
  ).toHaveCSS("color", "rgb(255, 255, 255)");

  const reviewCardBox = await page
    .locator("#zo-werkt-het article")
    .nth(2)
    .boundingBox();
  const starsBox = await page.locator("[data-bento-stars]").boundingBox();
  expect(reviewCardBox).not.toBeNull();
  expect(starsBox).not.toBeNull();
  expect(starsBox!.width / reviewCardBox!.width).toBeGreaterThan(0.45);
});

test("representative routes have no serious accessibility violations", async ({
  page,
}) => {
  for (const route of [
    "/",
    "/contact",
    "/beheer",
    "/algemene-voorwaarden",
    "/privacy-en-cookieverklaring",
    "/juridisch/algemene-voorwaarden/2026-07-07.1",
    "/juridisch/privacy-en-cookieverklaring/2026-07-18.1",
    "/404.html",
  ]) {
    await page.goto(route);
    await expect(page.locator("h1")).toHaveCount(1);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(
      results.violations.filter(
        (violation) =>
          violation.impact === "critical" || violation.impact === "serious",
      ),
    ).toEqual([]);
  }
});

test("contact and beheer validation contracts remain intact", async ({
  page,
}) => {
  await page.goto("/contact");
  await page.getByRole("button", { name: "Verstuur bericht" }).click();
  await expect(
    page.getByText("Vul je naam in zodat we weten met wie we praten."),
  ).toBeVisible();
  await expect(page.locator("#siab-name")).toHaveAttribute(
    "aria-invalid",
    "true",
  );

  await page.goto("/beheer");
  await page.locator("#tenant-domain").fill("geen geldig domein");
  await page.getByRole("button", { name: "Inloggen" }).click();
  await expect(
    page.getByText("Vul een geldig domein in, bijvoorbeeld ami-care.nl."),
  ).toBeVisible();
  await expect(page.locator("#tenant-domain")).toBeFocused();
});

test("contact success and failure states remain actionable", async ({
  page,
}) => {
  const fillContactForm = async () => {
    await page.locator("#siab-name").fill("Test gebruiker");
    await page.locator("#siab-email").fill("test@example.com");
    await page
      .locator("#siab-message")
      .fill("Dit is een testbericht voor de browsercontrole.");
    await page.locator("#siab-consent").check();
    await expect(page.locator('[name="cf-turnstile-response"]')).toHaveValue(
      "XXXX.DUMMY.TOKEN.XXXX",
    );
  };

  await page.route("**/api/contact", (route) =>
    route.fulfill({ status: 200, body: "{}" }),
  );
  await page.goto("/contact");
  await fillContactForm();
  await page.getByRole("button", { name: "Verstuur bericht" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Bedankt voor je bericht",
  );

  await page.unroute("**/api/contact");
  await page.route("**/api/contact", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ code: "turnstile_invalid" }),
    }),
  );
  await page.goto("/contact");
  await fillContactForm();
  await page.getByRole("button", { name: "Verstuur bericht" }).click();
  await expect(page.locator("[data-siab-turnstile-error]")).toContainText(
    "beveiligingscontrole is verlopen",
  );
  await expect(
    page.getByRole("button", { name: "Verstuur bericht" }),
  ).toBeEnabled();

  await page.unroute("**/api/contact");
  await page.route("**/api/contact", (route) =>
    route.fulfill({ status: 500, body: "{}" }),
  );
  await page.goto("/contact");
  await fillContactForm();
  await page.getByRole("button", { name: "Verstuur bericht" }).click();
  await expect(page.getByRole("alert")).toContainText("Versturen lukte niet");
  await expect(
    page.getByRole("button", { name: "Verstuur bericht" }),
  ).toBeEnabled();
});

test("beheer redirects valid tenant domains and public routing remains intact", async ({
  page,
}) => {
  await page.route("https://admin.ami-care.nl/login", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<title>Tenant login</title>",
    }),
  );
  await page.goto("/beheer");
  await page.locator("#tenant-domain").fill("https://www.ami-care.nl/");
  await page.getByRole("button", { name: "Inloggen" }).click();
  await expect(page).toHaveURL("https://admin.ami-care.nl/login");

  const redirectResponse = await page.goto("/privacy-policy");
  expect(redirectResponse?.ok()).toBe(true);
  await expect(page).toHaveURL(/\/privacy-en-cookieverklaring\/?$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /privacy-en-cookieverklaring/,
  );

  const missingResponse = await page.goto("/bestaat-niet");
  expect(missingResponse?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Page not found",
  );
});
