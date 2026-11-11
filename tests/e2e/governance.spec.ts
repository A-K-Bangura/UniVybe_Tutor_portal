import { test, expect, type Page } from "@playwright/test";
async function setup(
  page: Page,
  actorRole = "super_admin",
  original = false,
  targetRole = "tutor",
  createdBy = 9,
) {
  await page.addInitScript(() =>
    sessionStorage.setItem("univybe.token", "fixture"),
  );
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  let target = {
    id: 2,
    uuid: "creator-target",
    email: "target@example.test",
    full_name: "Target Creator",
    status: "pending",
    created_by: createdBy,
    is_original_super_admin: false,
    role: { id: targetRole === "admin" ? 1 : 3, name: targetRole },
    role_id: targetRole === "admin" ? 1 : 3,
  };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path.endsWith("/check") || path.endsWith("/auth/profile"))
      data = {
        user: {
          id: 1,
          email: "actor@example.test",
          firstname: "Actor",
          lastname: "Admin",
          phone: "076111111",
          status: "approved",
          role: { name: actorRole },
        },
      };
    else if (path.endsWith("/admin/roles"))
      data = {
        roles: [
          {
            id: 6,
            name: "super_admin",
            display_name: "Super Administrator",
            can_assign: original,
            can_create_account: false,
          },
          {
            id: 1,
            name: "admin",
            display_name: "Administrator",
            can_assign: actorRole === "super_admin",
            can_create_account: true,
            account_requires_super_admin_approval: actorRole === "admin",
          },
          {
            id: 3,
            name: "tutor",
            display_name: "Tutor",
            can_assign: actorRole === "super_admin",
            can_create_account: true,
          },
        ],
      };
    else if (path.includes("/admin/users")) {
      if (route.request().method() !== "GET") {
        const body = route.request().postDataJSON() || {};
        writes.push({ path, body });
        if (path.endsWith("/role"))
          target = {
            ...target,
            role: {
              id: Number(body.role_id),
              name: Number(body.role_id) === 1 ? "admin" : "super_admin",
            },
          };
      }
      data =
        path.endsWith("/users") && route.request().method() === "GET"
          ? [target]
          : { user: target, awaiting_super_admin_approval: true };
    }
    await route.fulfill({
      json: {
        success: true,
        message: "Saved",
        data,
        meta: {
          total: Array.isArray(data) ? data.length : 0,
          current_page: 1,
          last_page: 1,
        },
      },
    });
  });
  return writes;
}
test("ordinary admin creates pending admins using server roles and cannot moderate admins", async ({
  page,
}) => {
  const writes = await setup(page, "admin", false, "admin");
  await page.goto("/users/new");
  await page.getByLabel("Account role").selectOption("1");
  await expect(page.getByLabel("Status *", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/This Admin account will await/)).toBeVisible();
  await expect(
    page.getByRole("option", { name: "Super Administrator", exact: true }),
  ).toHaveCount(0);
  for (const [label, value] of [
    ["Email *", "new@example.test"],
    ["Password *", "StrongPassword123!"],
    ["Firstname *", "New"],
    ["Lastname *", "Admin"],
    ["Phone *", "076222222"],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  await expect(page).toHaveURL(/users\/creator-target$/);
  expect(writes[0].body).toMatchObject({ role_id: 1, status: "pending" });
  await expect(
    page.getByRole("button", { name: "Approve", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Change role", exact: true }),
  ).toHaveCount(0);
});
test("super admin role changes require a reason and use creator uuid", async ({
  page,
}) => {
  const writes = await setup(page);
  await page.goto("/users/creator-target");
  await page.getByRole("button", { name: "Change role", exact: true }).click();
  await page.getByLabel("New role").selectOption("1");
  await page.getByRole("button", { name: "Confirm action" }).click();
  expect(writes).toHaveLength(0);
  await page
    .getByLabel("Reason *", { exact: true })
    .fill("Leads the content team");
  await page.getByRole("button", { name: "Confirm action" }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({
    path: "/api/v1/admin/users/creator-target/role",
    body: { role_id: 1, reason: "Leads the content team" },
  });
});
test("a super admin cannot decide on their own pending admin submission", async ({
  page,
}) => {
  await setup(page, "super_admin", false, "admin", 1);
  await page.goto("/users/creator-target");
  await expect(
    page.getByRole("button", { name: "Approve", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Reject", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText(/Another Super Admin must decide/)).toBeVisible();
});
test("original authority offers super admin assignment; queue preserves required filters", async ({
  page,
}) => {
  await setup(page, "super_admin", true, "admin");
  await page.goto("/users/creator-target");
  await page.getByRole("button", { name: "Change role", exact: true }).click();
  await expect(
    page.getByRole("option", { name: "Super Administrator", exact: true }),
  ).toHaveCount(1);
  await page.goto("/users");
  await page.getByRole("link", { name: "Admin approval queue" }).click();
  await expect(page).toHaveURL(
    /role=admin&status=pending&user_type=creation_user/,
  );
});
test("inactive administrative authority redirects to account status", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/v1/admin/roles", (route) =>
    route.fulfill({
      status: 403,
      json: {
        success: false,
        error: {
          code: "ADMIN_ACCOUNT_NOT_ACTIVE",
          message: "Account inactive",
          details: { status: "suspended" },
        },
      },
    }),
  );
  await page.goto("/users/new");
  await expect(page).toHaveURL(/account-status$/);
  await expect(
    page.getByText(/Your administrative account is not active/),
  ).toBeVisible();
});
