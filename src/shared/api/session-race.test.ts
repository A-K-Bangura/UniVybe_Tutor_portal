import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { client, request, changeGeneration, setInvalidator } from "./client";
import { useSession } from "../auth/session";
const server = setupServer();
beforeAll(() => {
  client.defaults.baseURL = "http://localhost/api/v1/";
  server.listen({ onUnhandledRequest: "error" });
});
it("an older failed session check cannot overwrite a successful retry", async () => {
  let release: () => void = () => {};
  let reached: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let attempts = 0;
  server.use(
    http.get("http://localhost/api/v1/tutor/auth/check", () =>
      HttpResponse.json({ success: true, data: {} }),
    ),
    http.get("http://localhost/api/v1/tutor/auth/profile", async () => {
      if (++attempts === 1) {
        reached();
        await gate;
        return HttpResponse.json({ message: "Unavailable" }, { status: 503 });
      }
      return HttpResponse.json({
        success: true,
        data: {
          user: {
            id: 1,
            email: "fixture@example.test",
            status: "approved",
            role: { name: "admin" },
          },
        },
      });
    }),
  );
  sessionStorage.setItem("univybe.token", "synthetic-token");
  const old = useSession.getState().bootstrap();
  await started;
  await useSession.getState().bootstrap();
  expect(useSession.getState().state).toBe("ready");
  release();
  await old;
  expect(useSession.getState().state).toBe("ready");
  expect(useSession.getState().error).toBeUndefined();
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

it("a completed pending admin reaches account status without optional qualification, while incomplete names still require onboarding", async () => {
  server.use(
    http.get("http://localhost/api/v1/tutor/auth/check", () =>
      HttpResponse.json({ success: true, data: {} }),
    ),
  );
  sessionStorage.setItem("univybe.token", "synthetic-token");
  for (const [lastname, expected] of [
    ["Creator", "restricted"],
    ["", "onboarding"],
  ] as const) {
    server.use(
      http.get("http://localhost/api/v1/tutor/auth/profile", () =>
        HttpResponse.json({
          success: true,
          data: {
            user: {
              id: 10,
              email: "admin@example.test",
              status: "pending",
              role: { name: "admin" },
              firstname: "Amina",
              lastname,
              phone: "+23200000000",
            },
          },
        }),
      ),
    );
    await useSession.getState().bootstrap();
    expect(useSession.getState().state).toBe(expected);
  }
});
