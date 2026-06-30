import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const port = 4429;
const origin = `http://127.0.0.1:${port}`;
const intakeUrl = `${origin}/intake/`;

function startDevServer() {
  const server = spawn(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "astro", "dev", "--host", "127.0.0.1", "--port", String(port)],
    {
      cwd: new URL("..", import.meta.url),
      env: {
        ...process.env,
        NO_COLOR: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let output = "";
  server.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  return { server, getOutput: () => output };
}

async function waitForServer(getOutput) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 30_000) {
    try {
      const response = await fetch(intakeUrl);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }

    await delay(250);
  }

  throw new Error(`Intake dev server did not start.\n${getOutput()}`);
}

async function run() {
  const { server, getOutput } = startDevServer();
  let browser;

  try {
    await waitForServer(getOutput);

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });

    await page.goto(intakeUrl, { waitUntil: "networkidle" });
    await page.getByText("Vul je gegevens liever zelf in?").click();
    await page.getByRole("button", { name: /^Verder$/ }).click();
    await page.getByLabel(/bedrijfsnaam/i).fill("Testbedrijf");
    await page.getByLabel(/kvk/i).fill("12345678");
    await page.getByLabel(/adres/i).fill("Straat 1, Utrecht");
    await page.getByRole("button", { name: /^Verder$/ }).click();
    await page.getByLabel(/meteen begrijpen/i).fill(
      "Wij helpen ondernemers met duidelijke websites en snelle online zichtbaarheid.",
    );
    await page.getByText(/^Aanbod$/).click();

    const offer = page.getByLabel(/Aanbod 1/i);
    await offer.fill("Webdesign");

    const before = page.url();
    await offer.press("Enter");
    await page.waitForTimeout(500);
    const after = page.url();
    const heading = await page.locator("h1").first().innerText();

    if (after !== before) {
      throw new Error(`Expected Enter to keep URL ${before}, got ${after}`);
    }

    if (heading !== "Vertel over je bedrijf") {
      throw new Error(`Expected to stay on content step, got heading: ${heading}`);
    }
  } finally {
    await browser?.close();
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
