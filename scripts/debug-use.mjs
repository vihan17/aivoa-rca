import { chromium } from "playwright-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on("console", (m) => console.log("CONSOLE", m.type(), m.text()));
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("request", (r) => {
  if (r.method() !== "GET") console.log("REQUEST", r.method(), r.url(), (r.postData() || "").slice(0, 180));
});
page.on("response", async (r) => {
  if (r.request().method() !== "GET") console.log("RESPONSE", r.status(), r.url());
});

await page.goto("http://127.0.0.1:5173/new", { waitUntil: "networkidle" });
const buttons = await page.getByRole("button").evaluateAll((els) =>
  els.map((el) => ({ text: (el.textContent || "").trim().slice(0, 40), box: el.getBoundingClientRect().toJSON() })),
);
console.log("BUTTONS", JSON.stringify(buttons, null, 1));
const useCount = await page.getByRole("button", { name: "Use" }).count();
console.log("USE COUNT", useCount);
await page.getByRole("button", { name: "Use" }).first().click();
console.log("clicked use");
await page.waitForTimeout(2500);
console.log("SCROLL", await page.evaluate(() => document.querySelector("main")?.scrollTop));
console.log("RIGHT PANEL", (await page.locator("aside").last().innerText()).slice(0, 800));
console.log("TOASTS", (await page.locator("body").innerText()).includes("Source added"));
await page.screenshot({ path: "artifacts/debug-use.png" });
await browser.close();
