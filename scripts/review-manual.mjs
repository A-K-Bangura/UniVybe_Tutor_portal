import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/akbJ/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const output = resolve("docs/course-creation/.render");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  await page.setContent(await readFile("docs/course-creation/course-creation-manual.html", "utf8"));
  await page.screenshot({ path: resolve(output, "guide-opening.png") });
  await page.getByRole("heading", { name: "Module 3 Use every supported content type", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(output, "guide-content.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: resolve(output, "guide-mobile.png") });
  const checks = await page.evaluate(() => ({
    images: [...document.images].every(img => img.complete && img.naturalWidth > 0),
    overflow: document.documentElement.scrollWidth > innerWidth,
    headingCount: document.querySelectorAll("h3").length,
  }));
  if (!checks.images || checks.overflow || checks.headingCount !== 12) throw new Error(JSON.stringify(checks));
  console.log(JSON.stringify(checks));
} finally { await browser.close(); }
