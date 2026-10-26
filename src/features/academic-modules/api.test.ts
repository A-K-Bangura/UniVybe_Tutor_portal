import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  moduleDefaults,
  moduleRecord,
  modulesPage,
  registryPayload,
} from "./api";
import { courseFields } from "../courses/fields";
import { resourceFields } from "../resources/config";
import { serialize } from "../../shared/forms/SchemaForm";
import { can } from "../../shared/auth/session";
const module = {
  id: 12,
  code: "EEE 101",
  title: "Circuit Theory I",
  label: "EEE 101 — Circuit Theory I",
  scope: "department",
  is_active: true,
  university: { id: 1, name: "University" },
  faculty: { id: 3, name: "Engineering" },
  department: { id: 7, name: "Electrical" },
  courses_count: 2,
};
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  sessionStorage.clear();
});
afterAll(() => server.close());
it("requires a public context and reads flat pagination without sending a token", async () => {
  await expect(modulesPage(new URLSearchParams())).rejects.toThrow(
    "academic context",
  );
  sessionStorage.setItem("univybe.token", "fixture-only-token");
  server.use(
    http.get("*/api/v1/academic-modules", ({ request }) => {
      expect(request.headers.get("Authorization")).toBeNull();
      expect(new URL(request.url).searchParams.get("department_id")).toBe("7");
      return HttpResponse.json({
        success: true,
        data: [module],
        meta: { total: 16, current_page: 1, last_page: 2 },
      });
    }),
  );
  const result = await modulesPage(new URLSearchParams({ department_id: "7" }));
  expect(result.items[0].label).toBe(module.label);
  expect(result.last).toBe(2);
  expect(() => moduleRecord({ ...module, scope: "course_chapter" })).toThrow();
});
it("sends registry references as integers and clears course context/module atomically", () => {
  expect(
    serialize(courseFields, { academic_module_id: "12" }).academic_module_id,
  ).toBe(12);
  expect(
    serialize(courseFields, {
      faculty_id: "",
      department_id: "",
      academic_module_id: "",
    }),
  ).toMatchObject({
    faculty_id: null,
    department_id: null,
    academic_module_id: null,
  });
  expect(serialize(courseFields, {})).not.toHaveProperty("academic_module_id");
  expect(
    resourceFields.some((field) => field.name === "academic_module_id"),
  ).toBe(false);
});
it("uses hierarchy IDs and sends only changed registry fields without normalizing official codes", () => {
  const initial = moduleDefaults(module);
  expect(registryPayload({ ...initial, code: "eee-101" }, module)).toEqual({
    code: "eee-101",
  });
  expect(registryPayload({ is_active: false }, module)).toEqual({
    is_active: false,
  });
  expect(registryPayload({ ...initial, scope: "faculty" })).not.toHaveProperty(
    "department_id",
  );
  expect(registryPayload(initial)).toMatchObject({
    university_id: 1,
    faculty_id: 3,
    department_id: 7,
  });
  expect(can("admin", "academic-modules")).toBe(true);
  for (const role of ["tutor", "educator", "contributor", "moderator"] as const)
    expect(can(role, "academic-modules")).toBe(false);
});
