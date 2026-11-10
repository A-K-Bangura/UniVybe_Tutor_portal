import { expect, it } from "vitest";
import { coveragePayload, guideDefaults, guidePayload } from "./api";
import { can } from "../../shared/auth/session";
it("keeps existing proposals and only sends changed guide fields", () => {
  const initial = guideDefaults({
    name: "Live",
    whatsapp_number: "+23276555111",
    categories: [{ id: 1 }],
    coverage: [{ scope: "platform" }],
    pending_changes: { name: "Proposed" },
  });
  expect(initial.name).toBe("Proposed");
  expect(
    guidePayload({ ...initial, description: "Reviewer note" }, initial, false),
  ).toEqual({ description: "Reviewer note" });
  expect(guidePayload({ ...initial, name: "Live" }, initial, false)).toEqual({
    name: "Live",
  });
});
it("serializes resolved places without leaking labels or availability into requests", () => {
  expect(
    coveragePayload([
      { scope: "platform" },
      {
        scope: "department",
        university: { id: 1 },
        faculty: { id: 2 },
        department: { id: 3 },
        is_valid: true,
      },
    ]),
  ).toEqual([
    { all_universities: true },
    { university_id: 1, faculty_id: 2, department_id: 3 },
  ]);
});
it("allows all team roles to submit but only admins to review", () => {
  for (const role of [
    "admin",
    "educator",
    "tutor",
    "contributor",
    "moderator",
  ] as const) {
    expect(can(role, "guidance")).toBe(true);
    expect(can(role, "guidance-admin")).toBe(role === "admin");
  }
});
