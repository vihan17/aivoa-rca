import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outDir = path.resolve("artifacts");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--force-device-scale-factor=1", "--hide-scrollbars"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
const failed = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
});
page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
page.on("response", (res) => {
  if (res.status() >= 400) failed.push(`${res.status()} ${res.request().method()} ${res.url()}`);
});

const shot = async (name, fullPage = false) => {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  console.log(`screenshot ${file}`);
};

try {
  await page.goto("http://127.0.0.1:5173/new", { waitUntil: "networkidle", timeout: 45000 });
  await page.getByRole("button", { name: "Use", exact: true }).first().click();
  await page.getByRole("button", { name: /Extract & fill investigation/ }).waitFor({ timeout: 15000 });
  console.log("source loaded");
  await page.getByRole("button", { name: /Extract & fill investigation/ }).click();
  await page.getByText("Investigation populated").last().waitFor({ timeout: 180000 });
  console.log("extraction done");
  await page.waitForTimeout(500);
  await shot("flow-1-extracted");

  const title = await page.locator("#deviation-title, input").first().inputValue().catch(() => "");
  console.log("title value:", title);

  await page.getByRole("button", { name: /Build root cause analysis/ }).click();
  await page.getByText("Analysis ready").waitFor({ timeout: 360000 });
  console.log("analysis done");
  await page.waitForTimeout(500);
  await shot("flow-2-analysis-panel");

  await page.getByRole("button", { name: /Review causes/ }).click();
  await page.waitForTimeout(1000);
  await shot("flow-3-rca");
} catch (error) {
  console.log("FLOW ERROR:", error.message);
  await shot("flow-error").catch(() => {});
} finally {
  console.log(JSON.stringify({ errors, failed }, null, 2));
  await browser.close();
}
