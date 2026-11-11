import { expect, it } from "vitest";
import { targetRestriction } from "./governance";
import { can, roleSchema } from "../../shared/auth/session";
import { base } from "../catalog/service";
const admin = { id: 1, role: { name: "admin" } };
const superAdmin = { id: 1, role: { name: "super_admin" } };
it("accepts super admins and routes inherited workspaces through admin endpoints", () => {
  expect(roleSchema.parse("super_admin")).toBe("super_admin");
  for (const area of [
    "users",
    "guidance-admin",
    "courses",
    "coins",
    "gigs-admin",
    "academic-modules",
  ])
    expect(can("super_admin", area)).toBe(true);
  expect(base("courses", "super_admin")).toBe("admin/courses");
});
it("protects self and original accounts and enforces target hierarchy", () => {
  expect(
    targetRestriction(
      superAdmin,
      { id: 1, role: { name: "admin" } },
      "role",
      true,
    ),
  ).toContain("own");
  expect(
    targetRestriction(
      superAdmin,
      { id: 2, is_original_super_admin: true },
      "delete",
      true,
    ),
  ).toContain("protected");
  expect(
    targetRestriction(admin, { id: 2, role: { name: "admin" } }, "approve"),
  ).toContain("Super Admin");
  expect(
    targetRestriction(
      superAdmin,
      { id: 2, role: { name: "super_admin" } },
      "role",
    ),
  ).toContain("Original");
  expect(
    targetRestriction(
      superAdmin,
      { id: 2, role: { name: "super_admin" } },
      "role",
      true,
    ),
  ).toBe("");
});
it("blocks creator decisions without blocking suspension or student actions", () => {
  const target = {
    id: 2,
    created_by: 1,
    status: "pending",
    role: { name: "admin" },
  };
  expect(targetRestriction(superAdmin, target, "approve")).toContain("Another");
  expect(targetRestriction(superAdmin, target, "reject")).toContain("Another");
  expect(targetRestriction(superAdmin, target, "suspend")).toBe("");
  expect(
    targetRestriction(admin, { id: 1, user_type: "student" }, "suspend"),
  ).toBe("");
});
