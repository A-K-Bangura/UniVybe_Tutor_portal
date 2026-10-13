import { defineConfig } from "@playwright/test";
const port = Number(process.env.PLAYWRIGHT_PORT || 5173);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid PLAYWRIGHT_PORT");
const previewUrl = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  use: {
    baseURL: previewUrl,
    channel: process.platform === "win32" ? "msedge" : undefined,
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: previewUrl,
    reuseExistingServer: true,
  },
  reporter: "list",
});
