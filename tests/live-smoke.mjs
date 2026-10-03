// Opt-in read-only smoke test. Credentials come from runtime environment only.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
if (!process.env.PORTAL_SMOKE_EMAIL || !process.env.PORTAL_SMOKE_PASSWORD)
  throw new Error("Supply runtime smoke credentials; never commit them.");
await mkdir("docs/qa", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const failures = [];
page.on("pageerror", (error) => failures.push(error.message));
await page.goto("http://127.0.0.1:5173/login");
await page.screenshot({ path: "docs/qa/login-desktop.png", fullPage: true });
await page.getByLabel("Email *").fill(process.env.PORTAL_SMOKE_EMAIL);
await page
  .getByLabel("Password *", { exact: true })
  .fill(process.env.PORTAL_SMOKE_PASSWORD);
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL("**/dashboard");
await page.getByRole("heading", { name: /Good to see you/ }).waitFor();
await page.waitForLoadState("networkidle");
await page
  .locator(".loading")
  .first()
  .waitFor({ state: "hidden", timeout: 35000 });
await page.screenshot({
  path: "docs/qa/dashboard-desktop.png",
  fullPage: true,
});
for (const path of [
  "courses",
  "resources",
  "opportunities",
  "feed",
  "users",
  "roadmaps",
  "universities",
  "organizations",
  "coins/settings",
  "coins/exchanges",
  "coins/ledger",
  "resources/access-settings",
  "resources/purchases",
  "analytics",
  "reports",
  "system-health",
  "profile",
]) {
  await page.goto(`http://127.0.0.1:5173/${path}`);
  await page.waitForLoadState("networkidle");
  await page
    .locator(".loading")
    .first()
    .waitFor({ state: "hidden", timeout: 35000 });
  const errorCount = await page.getByRole("alert").count();
  console.log(JSON.stringify({ path, errorCount }));
}
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://127.0.0.1:5173/dashboard");
await page.getByRole("heading", { name: /Good to see you/ }).waitFor();
await page.waitForLoadState("networkidle");
await page
  .locator(".loading")
  .first()
  .waitFor({ state: "hidden", timeout: 35000 });
await page.screenshot({ path: "docs/qa/dashboard-mobile.png", fullPage: true });
console.log(
  JSON.stringify({
    pageErrors: failures,
    mobileOverflow: await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  }),
);
await page
  .getByRole("button", { name: "Open navigation", exact: true })
  .click();
await page.getByRole("button", { name: "Sign out", exact: true }).click();
await page.waitForURL("**/login");
await browser.close();
if (failures.length) process.exitCode = 1;
