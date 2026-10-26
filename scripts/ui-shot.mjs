import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outDir = path.resolve("artifacts");
fs.mkdirSync(outDir, { recursive: true });

const url = process.argv[2] || "http://127.0.0.1:5173";
const name = process.argv[3] || "shot";
const fullPage = process.argv.includes("--full");

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--force-device-scale-factor=1", "--hide-scrollbars"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
});
page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
await page.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch((e) => errors.push(`goto: ${e.message}`));
await page.waitForTimeout(1200);
const title = await page.title();
const bodyText = (await page.locator("body").innerText()).slice(0, 1800);
const file = path.join(outDir, `${name}.png`);
await page.screenshot({ path: file, fullPage });
await browser.close();
console.log(JSON.stringify({ url, title, file, errors, bodyText }, null, 2));
