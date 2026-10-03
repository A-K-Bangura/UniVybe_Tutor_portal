import { afterAll, beforeAll, afterEach, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { uploadResource } from "./workflows";
import { client } from "../api/client";
const server = setupServer();
beforeAll(() => {
  client.defaults.baseURL = "http://localhost/api/v1/";
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
it("never sends the API token to private storage and fails before registration when transfer fails", async () => {
  sessionStorage.setItem("univybe.token", "synthetic-test-token");
  let storageAuth: string | null = "not checked";
  server.use(
    http.post("http://localhost/api/v1/tutor/resources/uploads", () =>
      HttpResponse.json({
        success: true,
        data: {
          method: "PUT",
          upload_url: "https://storage.example.test/file",
          upload_token: "synthetic-upload-token",
          headers: { "Content-Type": "application/pdf" },
        },
      }),
    ),
    http.put("https://storage.example.test/file", ({ request }) => {
      storageAuth = request.headers.get("authorization");
      return new HttpResponse(null, { status: 503 });
    }),
  );
  await expect(
    uploadResource(
      new File(["%PDF"], "test.pdf", { type: "application/pdf" }),
      () => {},
      new AbortController().signal,
    ),
  ).rejects.toThrow();
  expect(storageAuth).toBeNull();
  sessionStorage.clear();
});
