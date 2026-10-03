import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { client, request, changeGeneration, setInvalidator } from "./client";
const server = setupServer();
beforeAll(() => {
  client.defaults.baseURL = "http://localhost/api/v1/";
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
  sessionStorage.clear();
});
afterAll(() => server.close());
it("an old 401 response cannot invalidate a newer session", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started: () => void = () => {};
  const reached = new Promise<void>((resolve) => {
    started = resolve;
  });
  server.use(
    http.get("http://localhost/api/v1/tutor/profile", async () => {
      started();
      await gate;
      return HttpResponse.json(
        { message: "Unauthenticated." },
        { status: 401 },
      );
    }),
  );
  const invalidate = vi.fn();
  setInvalidator(invalidate);
  sessionStorage.setItem("univybe.token", "synthetic-old");
  const pending = request("tutor/profile").catch((error) => error);
  await reached;
  changeGeneration();
  sessionStorage.setItem("univybe.token", "synthetic-new");
  release();
  await pending;
  expect(invalidate).not.toHaveBeenCalled();
  expect(sessionStorage.getItem("univybe.token")).toBe("synthetic-new");
});
