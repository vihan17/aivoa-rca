import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5173";
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

let live = false;
try {
  const health = await (await fetch(`${BASE_URL}/api/health`)).json();
  live = Boolean(health.ai?.live);
  console.log("PROVIDER", JSON.stringify(health.ai));
} catch (error) {
  console.log("PROVIDER CHECK FAILED", error.message);
}
const extractionTimeout = live ? 180000 : 90000;
const analysisTimeout = live ? 360000 : 120000;
const agentTimeout = live ? 180000 : 30000;

const shot = async (name) => {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file });
  console.log("SHOT", name);
};

const scrollTo = async (text) => {
  await page.getByText(text, { exact: false }).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(450);
};

try {
  await page.goto(`${BASE_URL}/new`, { waitUntil: "networkidle", timeout: 45000 });
  await page.getByRole("button", { name: "Use", exact: true }).first().click();
  await page.getByRole("button", { name: /Extract & fill investigation/ }).click();
  await page.getByText("Investigation populated").last().waitFor({ timeout: extractionTimeout });
  await page.getByRole("button", { name: /Build root cause analysis/ }).click();
  await page.getByText("Analysis ready").waitFor({ timeout: analysisTimeout });
  console.log("extracted + analysed");

  await page.locator("#section-evidence").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await shot("final-1-evidence-top");

  await scrollTo("Missing evidence & information");
  await shot("final-2-gaps");
  const gapText = await page.locator("#section-evidence").innerText();
  const gapIds = [...gapText.matchAll(/GAP-\d+/g)].map((match) => match[0]);
  console.log("GAP IDS", [...new Set(gapIds)].join(","));

  await page.getByRole("button", { name: /Verify high relevance/ }).click();
  await page.waitForTimeout(400);
  await page.locator("#section-evidence").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shot("final-3-evidence-verified");

  await page.locator("#section-rca").scrollIntoViewIfNeeded();
  await page.waitForTimeout(450);
  await shot("final-4-whys");
  await scrollTo("Root cause candidates");
  await shot("final-5-causes");

  await page.getByRole("button", { name: "Confirm as root cause" }).first().click();
  await page.waitForTimeout(300);
  await page.locator("#section-capa").scrollIntoViewIfNeeded();
  await page.waitForTimeout(450);
  await shot("final-6-capa");
  await page.locator("#section-capa").getByRole("button", { name: "Approve", exact: true }).first().click();
  await page.waitForTimeout(400);
  await shot("final-7-capa-approved");

  const titleInput = page.getByPlaceholder(/e.g. OOS impurity/);
  await titleInput.scrollIntoViewIfNeeded();
  await titleInput.click();
  await titleInput.press("End");
  await titleInput.type(" - QA review complete");
  await page.waitForTimeout(300);
  await shot("final-8-incident-edited");

  await page.locator("header").getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText(/RCA-2026-\d+ saved/).waitFor({ timeout: 30000 });
  await page.waitForTimeout(700);
  await shot("final-9-saved");

  await page.locator("#section-signoff").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await shot("final-10-signoff-ready");

  await page.locator("header").getByRole("button", { name: "Sign off", exact: true }).click();
  await page.getByRole("dialog").waitFor({ timeout: 10000 });
  await shot("final-11-signoff-modal");
  const boxes = page.locator('[role="dialog"] input[type="checkbox"]');
  const count = await boxes.count();
  for (let i = 0; i < count; i += 1) await boxes.nth(i).check();
  await page.locator("#signoff-statement").fill(
    "Approved after review of the drying record and calibration evidence. Residual gap GAP-02 tracked as a condition with a 7-day due date.",
  );
  await page.waitForTimeout(300);
  await shot("final-12-signoff-filled");
  await page.getByRole("button", { name: /Sign & approve/ }).click();
  await page.getByText(/Investigation signed and approved/).waitFor({ timeout: 30000 });
  console.log("signed");
  await page.waitForTimeout(900);
  await page.locator("#section-signoff").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await shot("final-13-signed");
  const signedText = await page.locator("body").innerText();
  const verifiedLine = signedText.split("\n").find((line) => line.includes("verified."));
  console.log("VERIFIED LINE", verifiedLine);

  await page.locator("#section-audit").scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await shot("final-14-audit");

  await page.getByRole("button", { name: "Ask copilot" }).click();
  const chatResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/ai/chat") &&
      response.request().method() === "POST" &&
      response.status() === 200,
    { timeout: agentTimeout },
  );
  await page.getByRole("button", { name: "Challenge the leading cause" }).click();
  await chatResponse;
  await page.waitForTimeout(900);
  await shot("final-15-chat");

  await page.getByRole("button", { name: /Draft the evidence request email/ }).click();
  await page.getByRole("dialog").waitFor({ timeout: agentTimeout });
  await page.waitForTimeout(400);
  await shot("final-16-email");
  await page.getByRole("button", { name: "Close", exact: true }).last().click();

  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot("final-17-dashboard");
  console.log("TITLE", await page.title());
} catch (error) {
  console.log("E2E ERROR:", error.message);
  await shot("final-error").catch(() => {});
} finally {
  console.log(JSON.stringify({ errors, failed }, null, 2));
  await browser.close();
  if (errors.length || failed.length) process.exitCode = 1;
}
