import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function fixture(page: import("@playwright/test").Page, role: string) {
  const user = {
    id: "fixture-user",
    email: "fixture@example.test",
    firstname: "Amina",
    lastname: "Creator",
    phone: "+23200000000",
    qualification: "Test qualification",
    status: "approved",
    role: { name: role },
  };
  await page.addInitScript(() =>
    sessionStorage.setItem("univybe.token", "synthetic-token"),
  );
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith("/check")
      ? { authenticated: true, user }
      : path.endsWith("/auth/profile")
        ? { user }
        : path.endsWith("/dashboard")
          ? {
              platform: { total_users: 12, total_courses: 3 },
              teaching: { total_courses: 3, total_students: 12 },
              realtime: { active_users: 2 },
            }
          : path.endsWith("/types")
            ? {
                resource_types: [{ value: "article", label: "Article" }],
                opportunity_types: [{ value: "job", label: "Job" }],
                action_types: [{ value: "apply", label: "Apply" }],
              }
            : [];
    await route.fulfill({
      json: {
        success: true,
        data,
        meta: { total: 0, current_page: 1, last_page: 1, per_page: 15 },
      },
    });
  });
}
test("role gates survive direct URLs", async ({ page }) => {
  await fixture(page, "educator");
  await page.goto("/feed");
  await expect(
    page.getByRole("heading", { name: "Access restricted" }),
  ).toBeVisible();
  await page.goto("/dashboard");
  await expect(
    page.getByRole("link", { name: "Community feed", exact: true }),
  ).toHaveCount(0);
});
test("mobile admin navigation exposes operational modules", async ({
  page,
}) => {
  await fixture(page, "admin");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Vybe Coins", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Opportunities", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Opportunities", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("failed save preserves draft and dirty navigation can stay", async ({
  page,
}) => {
  await fixture(page, "admin");
  await page.route("**/api/v1/tutor/opportunities", (route) =>
    route.fulfill({
      status: 422,
      json: {
        success: false,
        error: {
          message: "Validation failed",
          details: { "actions.0.url": ["Invalid action URL"] },
        },
      },
    }),
  );
  await page.goto("/opportunities/new");
  await page.getByLabel("Title *", { exact: true }).fill("Preserve this draft");
  await page.getByLabel("Short description *").fill("Draft details");
  await page.getByLabel("Opportunity type *").selectOption("job");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByText("Validation failed", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Title *", { exact: true })).toHaveValue(
    "Preserve this draft",
  );
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Stay", exact: true }).click();
  await expect(page).toHaveURL(/opportunities\/new/);
});
test("login screen has no critical accessibility violations", async ({
  page,
}) => {
  await page.goto("/login");
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact || ""),
    ),
  ).toEqual([]);
});
test("failed builder save keeps the selected draft and does not switch nodes", async ({
  page,
}) => {
  await fixture(page, "admin");
  const course = {
    id: 1,
    uuid: "course-1",
    title: "A test course",
    description: "Learning",
    status: "draft",
  };
  const modules = [
    { id: 11, title: "First module", course_id: 1, order_index: 0 },
    { id: 12, title: "Second module", course_id: 1, order_index: 1 },
  ];
  await page.route("**/api/v1/admin/courses/course-1", (route) =>
    route.fulfill({ json: { success: true, data: { course } } }),
  );
  await page.route("**/api/v1/tutor/courses/course-1/resources", (route) =>
    route.fulfill({ json: { success: true, data: { resources: [] } } }),
  );
  await page.route("**/api/v1/tutor/courses/1/modules", (route) =>
    route.fulfill({ json: { success: true, data: { modules } } }),
  );
  await page.route("**/api/v1/tutor/content/modules/11", (route) =>
    route.fulfill({
      status: 422,
      json: {
        success: false,
        error: {
          message: "Module save rejected",
          details: { title: ["Title requires revision"] },
        },
      },
    }),
  );
  await page.goto("/courses/course-1");
  await page.getByRole("button", { name: "First module", exact: true }).click();
  await page
    .getByLabel("Title *", { exact: true })
    .fill("Keep my changed module");
  await page
    .getByRole("button", { name: "Second module", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save and switch", exact: true })
    .click();
  await expect(
    page.getByText("Module save rejected", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stay", exact: true }).click();
  await expect(page.getByLabel("Title *", { exact: true })).toHaveValue(
    "Keep my changed module",
  );
});
test("rejected opportunity edit preserves deadline and only explicit resubmission changes state", async ({
  page,
}) => {
  await fixture(page, "contributor");
  let record = {
    id: 3,
    uuid: "opportunity-3",
    title: "Needs revision",
    short_description: "An opportunity",
    opportunity_type: "job",
    status: "rejected",
    application_deadline: "2027-12-31T17:00:00Z",
    rejection_reason: "Revise title",
    actions: [
      {
        type: "apply",
        label: "Apply",
        url: "https://example.test/apply",
        is_primary: true,
      },
    ],
    permissions: { can_edit: true, can_delete: true, can_submit: true },
  };
  let editedPayload: Record<string, unknown> = {};
  await page.route(
    "**/api/v1/tutor/opportunities/opportunity-3",
    async (route) => {
      if (route.request().method() === "PUT") {
        editedPayload = route.request().postDataJSON();
        record = { ...record, ...editedPayload };
      }
      await route.fulfill({
        json: { success: true, data: { opportunity: record } },
      });
    },
  );
  await page.route(
    "**/api/v1/tutor/opportunities/opportunity-3/submit",
    async (route) => {
      record = {
        ...record,
        status: "pending_approval",
        permissions: { can_edit: false, can_delete: false, can_submit: false },
      };
      await route.fulfill({
        json: { success: true, data: { opportunity: record } },
      });
    },
  );
  await page.goto("/opportunities/opportunity-3");
  await page.getByLabel("Title *", { exact: true }).fill("Revised opportunity");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Resubmit for approval", exact: true }),
  ).toBeVisible();
  expect(editedPayload).not.toHaveProperty("application_deadline");
  expect(editedPayload).not.toHaveProperty("actions");
  await page
    .getByRole("button", { name: "Resubmit for approval", exact: true })
    .click();
  await expect(
    page.getByText(
      "This record is locked for editing under its current permissions.",
    ),
  ).toBeVisible();
});
test("approved resource is locked for its contributor", async ({ page }) => {
  await fixture(page, "contributor");
  await page.route("**/api/v1/tutor/resources/resource-4", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          resource: {
            id: 4,
            title: "Approved notes",
            status: "approved",
            source_type: "file",
            permissions: { can_edit: false, can_delete: false },
          },
        },
      },
    }),
  );
  await page.goto("/resources/resource-4");
  await expect(
    page.getByText(
      "This record is locked for editing under its current permissions.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Delete", exact: true }),
  ).toHaveCount(0);
});
test("uncertain payout recording does not retry or claim success", async ({
  page,
}) => {
  await fixture(page, "admin");
  let attempts = 0;
  const exchange = {
    id: 5,
    uuid: "exchange-5",
    coins: 1000,
    leone_amount: 100,
    currency: "SLE",
    mobile_money_number: "+23200000000",
    status: "processing",
    events: [],
  };
  await page.route("**/api/v1/admin/coins/exchanges/exchange-5?*", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          exchange,
          student_balance: { available: 0, reserved: 1000, redeemed: 0 },
        },
      },
    }),
  );
  await page.route(
    "**/api/v1/admin/coins/exchanges/exchange-5/complete",
    (route) => {
      attempts++;
      return route.abort("failed");
    },
  );
  await page.goto("/coins/exchanges/exchange-5");
  await page
    .getByRole("button", { name: "Record payment completed", exact: true })
    .click();
  await page.getByLabel("Payout reference *").fill("SYNTHETIC-REF");
  await page
    .getByRole("button", { name: "Confirm action", exact: true })
    .click();
  await expect(page.getByText(/Outcome uncertain/)).toBeVisible();
  expect(attempts).toBe(1);
  await expect(
    page.getByText("Confirmed by server", { exact: true }),
  ).toHaveCount(0);
});

test("a stale roadmap order keeps the draft and blocks leaving after a failed save", async ({
  page,
}) => {
  await fixture(page, "admin");
  const roadmap = {
    id: 2,
    title: "Learning path",
    status: "draft",
    courses: [
      {
        course_id: 11,
        course: { id: 11, title: "Foundations", status: "published" },
      },
      {
        course_id: 12,
        course: { id: 12, title: "Next steps", status: "published" },
      },
    ],
  };
  await page.route("**/api/v1/admin/roadmaps/2", (route) =>
    route.fulfill({ json: { success: true, data: { roadmap } } }),
  );
  await page.route("**/api/v1/admin/roadmaps/2/courses/order", (route) =>
    route.fulfill({
      status: 409,
      json: { message: "The sequence changed. Refresh before saving." },
    }),
  );
  await page.goto("/roadmaps/2");
  await page
    .locator(".sequence-row")
    .first()
    .getByRole("button", { name: "↓", exact: true })
    .click();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Save and leave", exact: true })
    .click();
  await expect(
    page
      .getByText("The sequence changed. Refresh before saving.", {
        exact: true,
      })
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stay", exact: true }).click();
  await expect(page).toHaveURL(/roadmaps\/2/);
  await expect(page.locator(".sequence-row").first()).toContainText(
    "Next steps",
  );
});

test("mobile course builder and dark appearance retain usable layout", async ({
  page,
}) => {
  await fixture(page, "tutor");
  const course = {
    id: 1,
    title: "Learning together",
    description: "Course content",
    status: "draft",
  };
  await page.route("**/api/v1/tutor/courses/1", (route) =>
    route.fulfill({ json: { success: true, data: { course } } }),
  );
  await page.route("**/api/v1/tutor/courses/1/modules", (route) =>
    route.fulfill({ json: { success: true, data: { modules: [] } } }),
  );
  await page.route("**/api/v1/tutor/courses/1/resources", (route) =>
    route.fulfill({ json: { success: true, data: { resources: [] } } }),
  );
  await page.goto("/courses/1");
  await expect(
    page.getByRole("heading", { name: "Course outline", exact: true }),
  ).toBeVisible();
  await page.locator(".loading").first().waitFor({ state: "hidden" });
  await page.screenshot({
    path: test.info().outputPath("builder-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/courses/1");
  await expect(
    page.getByRole("heading", { name: "Course outline", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Switch to dark appearance", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("builder-mobile-dark.png"),
    fullPage: true,
  });
});
