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
test("department faculty dropdown loads all pages and saves the selected ID", async ({
  page,
}) => {
  await fixture(page, "admin");
  const fetchedPages: number[] = [];
  await page.route("**/api/v1/admin/faculties?*", async (route) => {
    expect(route.request().headers().authorization).toBe(
      "Bearer synthetic-token",
    );
    const index = Number(
      new URL(route.request().url()).searchParams.get("page"),
    );
    fetchedPages.push(index);
    await route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: index === 1 ? 2 : 8,
            name: index === 1 ? "Engineering" : "Business",
            university: { name: "Example University" },
          },
        ],
        meta: { current_page: index, last_page: 2, per_page: 50, total: 2 },
      },
    });
  });
  const department = {
    id: 5,
    faculty_id: 8,
    name: "Accounting",
    is_active: true,
  };
  await page.route("**/api/v1/admin/departments/5", (route) =>
    route.fulfill({ json: { success: true, data: { department } } }),
  );
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/api/v1/admin/departments", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: { success: true, data: { department } },
    });
  });
  await page.goto("/departments/new");
  const faculty = page.getByLabel("Faculty *", { exact: true });
  await expect(faculty).toHaveRole("combobox");
  await expect(
    faculty.getByRole("option", { name: "Business — Example University" }),
  ).toHaveCount(1);
  expect([...new Set(fetchedPages)]).toEqual([1, 2]);
  await faculty.selectOption("8");
  await page.getByLabel("Name *", { exact: true }).fill("Accounting");
  await page
    .getByRole("button", { name: "Create department", exact: true })
    .click();
  await expect(page).toHaveURL(/\/departments\/5$/);
  expect(submitted?.faculty_id).toBe(8);
  await expect(faculty).toHaveValue("8");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(faculty).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

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

test("desktop sidebar closes and builder panes scroll independently", async ({
  page,
}) => {
  await fixture(page, "tutor");
  const course = {
    id: 1,
    title: "Scroll test course",
    description: "Content",
    status: "draft",
  };
  await page.route("**/api/v1/tutor/courses/1", (route) =>
    route.fulfill({ json: { success: true, data: { course } } }),
  );
  await page.route("**/api/v1/tutor/courses/1/modules", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          modules: Array.from({ length: 35 }, (_, i) => ({
            id: i + 1,
            title: `Module ${i + 1}`,
          })),
        },
      },
    }),
  );
  await page.route("**/api/v1/tutor/courses/1/resources", (route) =>
    route.fulfill({ json: { success: true, data: { resources: [] } } }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/courses/1");
  await expect(
    page.getByRole("button", { name: "Module 35", exact: true }),
  ).toBeAttached();
  const before = await page.locator(".editor-panel").boundingBox();
  await page
    .getByRole("button", { name: "Close sidebar", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Workspace navigation" }),
  ).toBeHidden();
  const after = await page.locator(".editor-panel").boundingBox();
  expect(after!.width).toBeGreaterThan(before!.width);
  expect(after!.height).toBeGreaterThanOrEqual(740);
  const divider = page.getByRole("separator", {
    name: "Resize course outline",
  });
  await divider.focus();
  const oldShare = Number(await divider.getAttribute("aria-valuenow"));
  await divider.press("ArrowRight");
  await expect(divider).toHaveAttribute("aria-valuenow", String(oldShare + 2));
  const outlineBefore = (await page.locator(".course-outline").boundingBox())!
    .width;
  const editorBefore = (await page.locator(".editor-panel").boundingBox())!
    .width;
  const handle = (await divider.boundingBox())!;
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(handle.x + 90, handle.y + handle.height / 2);
  await page.mouse.up();
  await expect
    .poll(
      async () => (await page.locator(".course-outline").boundingBox())!.width,
    )
    .toBeGreaterThan(outlineBefore);
  const outlineAfter = (await page.locator(".course-outline").boundingBox())!
    .width;
  const editorAfter = (await page.locator(".editor-panel").boundingBox())!
    .width;
  expect(editorAfter).toBeLessThan(editorBefore);
  expect(outlineAfter + editorAfter).toBeCloseTo(
    outlineBefore + editorBefore,
    0,
  );
  const savedShare = await divider.getAttribute("aria-valuenow");
  const scrolled = await page.evaluate(() => {
    const outline = document.querySelector<HTMLElement>(".course-outline")!;
    const editor = document.querySelector<HTMLElement>(".editor-panel")!;
    outline.scrollTop = 200;
    const first = { outline: outline.scrollTop, editor: editor.scrollTop };
    editor.scrollTop = 300;
    return {
      first,
      second: { outline: outline.scrollTop, editor: editor.scrollTop },
      thin: getComputedStyle(outline).scrollbarWidth,
    };
  });
  expect(scrolled.first.outline).toBeGreaterThan(0);
  expect(scrolled.first.editor).toBe(0);
  expect(scrolled.second.outline).toBe(scrolled.first.outline);
  expect(scrolled.second.editor).toBeGreaterThan(0);
  expect(scrolled.thin).toBe("thin");
  await page.screenshot({
    path: test.info().outputPath("builder-expanded-workspace.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(divider).toHaveAttribute("aria-valuenow", savedShare!);
  await expect(
    page.getByRole("button", { name: "Open sidebar", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open sidebar", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "Workspace navigation" }),
  ).toBeVisible();
});

test("nested back links work on direct entry and guard unsaved course changes", async ({
  page,
}) => {
  await fixture(page, "tutor");
  const course = {
    id: 1,
    title: "Course",
    description: "Content",
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
  await page.getByLabel("Title *", { exact: true }).fill("Unsaved title");
  await page
    .getByRole("link", { name: "Back to courses", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "You have unsaved changes" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stay", exact: true }).click();
  await expect(page.getByLabel("Title *", { exact: true })).toHaveValue(
    "Unsaved title",
  );
  await page
    .getByRole("link", { name: "Back to courses", exact: true })
    .click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page).toHaveURL(/\/courses$/);
  await page.goto("/courses/1/analytics");
  await page.getByRole("link", { name: "Back to course", exact: true }).click();
  await expect(page).toHaveURL(/\/courses\/1$/);
});

test("analytics charts follow the selected view and expose their data on mobile", async ({
  page,
}) => {
  await fixture(page, "admin");
  await page.route("**/api/v1/admin/analytics/users?*", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          growth: [
            { date: "2026-10-01", students: 12, tutors: 2 },
            { date: "2026-10-02", students: 20, tutors: 3 },
          ],
          demographics: {
            geographic_distribution: { Njala: 15 },
            gender_distribution: { female: 10, male: 5 },
          },
          retention: {
            day_1_retention: 90,
            day_7_retention: 70,
            day_30_retention: 50,
          },
        },
      },
    }),
  );
  await page.goto("/analytics");
  await page.getByRole("button", { name: "users", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "New students and tutors", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".analytics-chart svg.recharts-surface").first(),
  ).toBeVisible();
  await page
    .locator(".analytics-chart")
    .first()
    .getByText("View chart data", { exact: true })
    .click();
  await expect(
    page
      .locator(".analytics-chart")
      .first()
      .getByRole("cell", { name: "12", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("analytics-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: test.info().outputPath("analytics-mobile.png"),
    fullPage: true,
  });
});

test("session recovery redirects approved accounts and local sign-out exits the status page", async ({
  page,
}) => {
  await fixture(page, "admin");
  await page.goto("/account-status");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.route("**/api/v1/tutor/auth/profile", (route) =>
    route.fulfill({
      status: 503,
      json: { message: "Temporarily unavailable" },
    }),
  );
  await page.reload();
  await expect(page).toHaveURL(/\/account-status$/);
  await expect(
    page.getByRole("heading", { name: "Your session needs a connection" }),
  ).toBeVisible();
  await page.unroute("**/api/v1/tutor/auth/profile");
  await page
    .getByRole("button", { name: "Check account state", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.route("**/api/v1/tutor/auth/profile", (route) =>
    route.fulfill({
      status: 503,
      json: { message: "Temporarily unavailable" },
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Sign out locally", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sign out locally", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    await page.evaluate(() => sessionStorage.getItem("univybe.token")),
  ).toBeNull();
});

test("roadmap course discovery requires explicit filters and fetch and submits selected IDs", async ({
  page,
}) => {
  await fixture(page, "admin");
  let queries = 0;
  let saved: Record<string, unknown> = {};
  await page.route("**/api/v1/admin/courses?*", (route) => {
    queries++;
    expect(new URL(route.request().url()).searchParams.get("status")).toBe(
      "published",
    );
    return route.fulfill({
      json: {
        success: true,
        data: [
          { id: 11, title: "Foundations", status: "published" },
          { id: 12, title: "Next steps", status: "published" },
        ],
        meta: { current_page: 1, last_page: 1, total: 2 },
      },
    });
  });
  await page.route("**/api/v1/admin/roadmaps", (route) => {
    saved = route.request().postDataJSON();
    return route.fulfill({
      json: { success: true, data: { roadmap: { id: 2, title: "My path" } } },
    });
  });
  await page.route("**/api/v1/admin/roadmaps/2", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          roadmap: { id: 2, title: "My path", status: "draft", courses: [] },
        },
      },
    }),
  );
  await page.goto("/roadmaps/new");
  await expect(
    page.getByRole("button", { name: "Fetch courses", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Course status filter").selectOption("published");
  await page.getByLabel("Course search filter").fill("Engineering");
  expect(queries).toBe(0);
  await page
    .getByRole("button", { name: "Fetch courses", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Select Foundations", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "Select Next steps", exact: true })
    .check();
  await page.getByLabel("Course search filter").fill("Changed filter");
  expect(queries).toBe(1);
  await page.getByLabel("Title *", { exact: true }).fill("My path");
  await page.getByLabel("Status *", { exact: true }).selectOption("draft");
  await page.screenshot({
    path: test.info().outputPath("roadmap-course-picker.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Create roadmap", exact: true })
    .click();
  await expect(page).toHaveURL(/\/roadmaps\/2$/);
  expect(saved.courses).toEqual([11, 12]);
  expect(queries).toBe(1);
  await expect(page.getByLabel("Course ID to add")).toHaveCount(0);
});

test("roadmap institution and creator filters use verified keys and reset dependent selections", async ({
  page,
}) => {
  await fixture(page, "admin");
  const queries: URLSearchParams[] = [];
  const lookup = (items: Record<string, unknown>[]) => ({
    success: true,
    data: items,
    meta: { current_page: 1, last_page: 1, total: items.length },
  });
  await page.route("**/api/v1/organizations?*", (route) =>
    route.fulfill({ json: lookup([{ id: 7, name: "Creator Academy" }]) }),
  );
  await page.route("**/api/v1/universities?*", (route) =>
    route.fulfill({
      json: lookup([
        { id: 1, name: "Uni One" },
        { id: 2, name: "Uni Two" },
      ]),
    }),
  );
  await page.route("**/api/v1/universities/*/faculties?*", (route) =>
    route.fulfill({ json: lookup([{ id: 10, name: "Engineering" }]) }),
  );
  await page.route(
    "**/api/v1/universities/*/faculties/*/departments?*",
    (route) => route.fulfill({ json: lookup([{ id: 20, name: "Computing" }]) }),
  );
  await page.route("**/api/v1/admin/users?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    expect(params.get("user_type")).toBe("creation_user");
    expect(params.get("search")).toBe("Amina");
    return route.fulfill({
      json: lookup([
        {
          id: 3,
          firstname: "Amina",
          lastname: "Creator",
          email: "amina@example.test",
        },
      ]),
    });
  });
  await page.route("**/api/v1/admin/courses?*", (route) => {
    queries.push(new URL(route.request().url()).searchParams);
    return route.fulfill({
      json: lookup([{ id: 11, title: "Foundations", status: "published" }]),
    });
  });
  await page.goto("/roadmaps/new");
  await page.getByLabel("Course university filter").selectOption("1");
  await page.getByLabel("Course faculty filter").selectOption("10");
  await page.getByLabel("Course department filter").selectOption("20");
  await page.getByLabel("Course organization filter").selectOption("7");
  await page.getByLabel("Course semester filter").fill("First Semester");
  await page.getByLabel("Course creator search").fill("Amina");
  await page
    .getByRole("button", { name: "Find creators", exact: true })
    .click();
  await page.getByLabel("Course creator filter").selectOption("3");
  await page.getByLabel("Course status filter").selectOption("published");
  await page.getByLabel("Course level filter").selectOption("100");
  expect(queries).toHaveLength(0);
  await page
    .getByRole("button", { name: "Fetch courses", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Select Foundations" }),
  ).toBeVisible();
  expect(Object.fromEntries(queries[0])).toMatchObject({
    university_id: "1",
    faculty_id: "10",
    department_id: "20",
    created_by: "3",
    status: "published",
    level: "100",
    organization_id: "7",
    semester: "First Semester",
  });
  expect(queries[0].has("creator_id")).toBe(false);
  await page.getByLabel("Course university filter").selectOption("2");
  await expect(page.getByLabel("Course faculty filter")).toHaveValue("");
  await expect(page.getByLabel("Course department filter")).toHaveValue("");
  await expect(page.getByLabel("Course department filter")).toBeDisabled();
  expect(queries).toHaveLength(1);
  await page.screenshot({
    path: test.info().outputPath("course-filters-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: test.info().outputPath("course-filters-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("admin approval lists start pending without an initial all-status request", async ({
  page,
}) => {
  await fixture(page, "admin");
  const requests: { kind: string; status: string | null }[] = [];
  await page.route(
    /\/api\/v1\/admin\/(courses|resources|opportunities|feed|users)\?/,
    (route) => {
      const url = new URL(route.request().url());
      requests.push({
        kind: url.pathname.split("/").at(-1)!,
        status: url.searchParams.get("status"),
      });
      return route.fulfill({
        json: {
          success: true,
          data: [],
          meta: { current_page: 1, last_page: 1, total: 0 },
        },
      });
    },
  );
  for (const [kind, pending] of Object.entries({
    courses: "pending_approval",
    resources: "pending_approval",
    opportunities: "pending_approval",
    feed: "pending",
    users: "pending",
  })) {
    await page.goto(`/${kind}`);
    await expect(page.getByLabel("Filter by status")).toHaveValue(pending);
    await expect
      .poll(() => requests.filter((r) => r.kind === kind).length)
      .toBeGreaterThan(0);
    await page.goto(`/reviews/${kind}`);
    await expect(page.getByLabel("Filter by status")).toHaveValue(pending);
    expect(
      requests
        .filter((r) => r.kind === kind)
        .every((r) => r.status === pending),
    ).toBe(true);
  }
  await page.goto("/reviews/courses?status=published");
  await expect(page.getByLabel("Filter by status")).toHaveValue("published");
  await expect.poll(() => requests.at(-1)?.status).toBe("published");
  await page.getByLabel("Filter by status").selectOption("");
  await expect.poll(() => requests.at(-1)?.status).toBeNull();
  await page.getByRole("textbox", { name: "Search courses" }).fill("Physics");
  await expect(page.getByLabel("Filter by status")).toHaveValue("");
  await page.reload();
  await expect(page.getByLabel("Filter by status")).toHaveValue("");
  expect(requests.at(-1)?.status).toBeNull();
  await page.getByLabel("Filter by status").selectOption("pending_approval");
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page.getByLabel("Filter by status")).toHaveValue("");
  await expect(
    page.getByRole("textbox", { name: "Search courses" }),
  ).toHaveValue("");
});

test("pending defaults do not narrow creator lists or non-approval admin pages", async ({
  page,
}) => {
  await fixture(page, "educator");
  const statuses: (string | null)[] = [];
  await page.route("**/api/v1/tutor/courses?*", (route) => {
    statuses.push(new URL(route.request().url()).searchParams.get("status"));
    return route.fulfill({
      json: {
        success: true,
        data: [],
        meta: { current_page: 1, last_page: 1, total: 0 },
      },
    });
  });
  await page.goto("/courses");
  await expect(page.getByLabel("Filter by status")).toHaveValue("");
  await expect.poll(() => statuses.length).toBeGreaterThan(0);
  expect(statuses.every((s) => s === null)).toBe(true);
});

test("exchange queue defaults pending and preserves explicit all when filtering by student", async ({
  page,
}) => {
  await fixture(page, "admin");
  const requests: URLSearchParams[] = [];
  await page.route("**/api/v1/admin/coins/exchanges?*", (route) => {
    requests.push(new URL(route.request().url()).searchParams);
    return route.fulfill({
      json: {
        success: true,
        data: [],
        meta: { current_page: 1, last_page: 1, total: 0 },
      },
    });
  });
  await page.goto("/coins/exchanges");
  await expect(page.getByLabel("Exchange status")).toHaveValue("pending");
  expect(requests.every((p) => p.get("status") === "pending")).toBe(true);
  await page.getByLabel("Exchange status").selectOption("");
  await expect.poll(() => requests.at(-1)?.has("status")).toBe(false);
  await page.getByLabel("Student ID or UUID").fill("42");
  await expect.poll(() => requests.at(-1)?.get("student_id")).toBe("42");
  expect(requests.at(-1)?.has("status")).toBe(false);
  await expect(page.getByLabel("Exchange status")).toHaveValue("");
  await page.goto("/roadmaps");
  await expect(page.getByLabel("Filter by status")).toHaveValue("");
});

test("resource attachments fetch only on request and retain detailed selections across pages and failed saves", async ({
  page,
}) => {
  await fixture(page, "tutor");
  const existing = {
    id: 102,
    title: "Python reference",
    resource_type: "book",
    format: "pdf",
    author: "Dr. Kamara",
    description: "A practical reference.",
  };
  const resource = {
    id: 7,
    title: "Digital systems notes",
    description: "Binary arithmetic and logic design.",
    resource_type: "lecture_notes",
    resource_type_label: "Lecture Notes",
    source_type: "file",
    format: "pdf",
    author: "Amina Sesay",
    subject: "Electronics",
    module: "EE101",
    publication_year: 2025,
    source: "Department archive",
    tags: ["digital", "logic"],
    academic_context: {
      level: "200",
      semester: "First Semester",
      university: { id: 1, name: "University One" },
    },
    file: {
      original_filename: "digital-notes.pdf",
      size_bytes: 482113,
      version: 2,
    },
    uploaded_by: "Amina Creator",
  };
  const another = {
    id: 8,
    title: "Logic tutorial",
    source_type: "external",
    resource_type: "video",
    format: "youtube_video",
    author: "Logic Lab",
  };
  let attached = [existing];
  const queries: URLSearchParams[] = [];
  const saves: number[][] = [];
  await page.route("**/api/v1/tutor/courses/1", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          course: {
            id: 1,
            title: "Engineering course",
            description: "Course",
            status: "draft",
          },
        },
      },
    }),
  );
  await page.route("**/api/v1/tutor/courses/1/resources", (route) => {
    if (route.request().method() === "PUT") {
      saves.push(route.request().postDataJSON().resource_ids);
      if (saves.length === 1)
        return route.fulfill({
          status: 422,
          json: {
            success: false,
            error: {
              message: "Resource approval changed",
              details: { resource_ids: ["Check eligibility"] },
            },
          },
        });
      attached = [existing, resource];
      return route.fulfill({
        json: { success: true, data: { resources: attached } },
      });
    }
    return route.fulfill({
      json: { success: true, data: { resources: attached } },
    });
  });
  await page.route("**/api/v1/resources/types", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          resource_types: [{ value: "lecture_notes", label: "Lecture Notes" }],
          source_types: [
            { value: "file", label: "Uploaded File" },
            { value: "external", label: "External Link" },
          ],
          file_formats: [{ value: "pdf", label: "PDF" }],
          link_types: [{ value: "youtube_video", label: "YouTube video" }],
        },
      },
    }),
  );
  await page.route("**/api/v1/student/resources?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    queries.push(params);
    if (params.get("search") === "Changed search")
      return route.fulfill({
        status: 503,
        json: { success: false, message: "Resource search unavailable" },
      });
    const second = params.get("page") === "2";
    return route.fulfill({
      json: {
        success: true,
        data: [second ? another : resource],
        meta: { current_page: second ? 2 : 1, last_page: 2, total: 2 },
      },
    });
  });
  await page.goto("/courses/1");
  const panel = page.getByRole("region", { name: "Resource attachments" });
  await expect(
    panel.getByText("Python reference", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Fetch resources", exact: true }),
  ).toBeDisabled();
  expect(queries).toHaveLength(0);
  await panel.getByLabel("Find approved resources").fill("Digital");
  await panel
    .getByLabel("Resource resource_type filter")
    .selectOption("lecture_notes");
  await panel.getByLabel("Resource source_type filter").selectOption("file");
  await panel.getByLabel("Resource format filter").selectOption("pdf");
  await panel.getByText("More resource filters", { exact: true }).click();
  await panel.getByLabel("Resource subject filter").fill("Electronics");
  await panel.getByLabel("Resource tags filter").fill("digital, logic");
  await panel.getByLabel("Resource semester filter").fill("First Semester");
  await panel.getByLabel("Resource publication_year filter").fill("2025");
  expect(queries).toHaveLength(0);
  await panel
    .getByRole("button", { name: "Fetch resources", exact: true })
    .click();
  await expect(
    panel.getByRole("button", {
      name: "Attach Digital systems notes",
      exact: true,
    }),
  ).toBeVisible();
  expect(Object.fromEntries(queries[0])).toMatchObject({
    search: "Digital",
    resource_type: "lecture_notes",
    source_type: "file",
    format: "pdf",
    subject: "Electronics",
    semester: "First Semester",
    publication_year: "2025",
  });
  expect(queries[0].getAll("tags[]")).toEqual(["digital", "logic"]);
  await panel
    .getByText("Details for Digital systems notes", { exact: true })
    .click();
  await expect(
    panel.getByText("digital-notes.pdf", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("University One", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("Binary arithmetic and logic design.", { exact: true }),
  ).toBeVisible();
  expect(queries).toHaveLength(1);
  await panel
    .getByRole("button", { name: "Attach Digital systems notes", exact: true })
    .click();
  await panel.getByLabel("Find approved resources").fill("Changed search");
  expect(queries).toHaveLength(1);
  await panel
    .getByRole("button", { name: "Next resources", exact: true })
    .click();
  await expect(
    panel.getByRole("button", { name: "Attach Logic tutorial", exact: true }),
  ).toBeVisible();
  expect(queries[1].get("search")).toBe("Digital");
  await expect(
    panel.getByText("Digital systems notes", { exact: true }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Fetch resources", exact: true })
    .click();
  await expect(
    panel.getByText("Resource search unavailable", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", {
      name: "Detach Digital systems notes",
      exact: true,
    }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Save ordered attachments", exact: true })
    .click();
  await expect(
    panel.getByText("Resource approval changed", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", {
      name: "Detach Digital systems notes",
      exact: true,
    }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Save ordered attachments", exact: true })
    .click();
  await expect(
    panel.getByRole("button", {
      name: "Save ordered attachments",
      exact: true,
    }),
  ).toBeDisabled();
  expect(saves).toEqual([
    [102, 7],
    [102, 7],
  ]);
  await page.locator(".editor-panel").screenshot({
    path: test.info().outputPath("resource-attachments-desktop.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".editor-panel").screenshot({
    path: test.info().outputPath("resource-attachments-mobile.png"),
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("uncertain resource attachment save reconciles the ordered server list before another save", async ({
  page,
}) => {
  await fixture(page, "tutor");
  let attached = [
    { id: 1, title: "First reference" },
    { id: 2, title: "Second reference" },
  ];
  let mutations = 0;
  await page.route("**/api/v1/tutor/courses/1", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          course: {
            id: 1,
            title: "Course",
            description: "Course",
            status: "draft",
          },
        },
      },
    }),
  );
  await page.route("**/api/v1/tutor/courses/1/resources", (route) => {
    if (route.request().method() === "PUT") {
      mutations++;
      attached = [attached[1], attached[0]];
      return route.fulfill({
        status: 503,
        json: { success: false, message: "Response unavailable" },
      });
    }
    return route.fulfill({
      json: { success: true, data: { resources: attached } },
    });
  });
  await page.goto("/courses/1");
  const panel = page.getByRole("region", { name: "Resource attachments" });
  await panel
    .getByRole("button", { name: "Move Second reference up", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Save ordered attachments", exact: true })
    .click();
  await expect(panel.getByText(/The save result is uncertain/)).toBeVisible();
  await expect(
    panel.getByRole("button", {
      name: "Save ordered attachments",
      exact: true,
    }),
  ).toBeDisabled();
  await panel
    .getByRole("button", { name: "Check current state", exact: true })
    .click();
  await expect(panel.getByText(/The save result is uncertain/)).toHaveCount(0);
  await expect(
    panel.getByRole("button", {
      name: "Save ordered attachments",
      exact: true,
    }),
  ).toBeDisabled();
  expect(mutations).toBe(1);
});

test("successful onboarding navigates to pending account status and completed users cannot reopen the form", async ({
  page,
}) => {
  await fixture(page, "tutor");
  let completed = false;
  const user = {
    id: 10,
    email: "new@example.test",
    status: "pending",
    role: { name: "tutor" },
    firstname: "Amina",
    lastname: "Creator",
    phone: "+23280123456",
    qualification: "Graduate",
  };
  await page.route("**/api/v1/tutor/auth/profile", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          user: completed
            ? user
            : { ...user, firstname: "", phone: "", qualification: "" },
        },
      },
    }),
  );
  await page.route("**/api/v1/universities?*", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [{ id: 1, name: "University One" }],
        meta: { current_page: 1, last_page: 1, total: 1 },
      },
    }),
  );
  await page.route("**/api/v1/tutor/auth/complete-onboarding", (route) => {
    completed = true;
    return route.fulfill({ json: { success: true, data: { user } } });
  });
  await page.goto("/onboarding");
  for (const [name, value] of Object.entries({
    "Firstname *": "Amina",
    "Lastname *": "Creator",
    "Phone *": "+23280123456",
    "Password *": "TestPassword123!",
    "Password confirmation *": "TestPassword123!",
    "Qualification *": "Graduate",
    "Expertise area *": "Engineering",
    "Years experience *": "5",
  }))
    await page.getByLabel(name, { exact: true }).fill(value);
  await page.getByLabel("University *", { exact: true }).selectOption("1");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(/\/account-status$/);
  await expect(
    page.getByRole("heading", { name: "Account pending", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Make yourself at home", exact: true }),
  ).toHaveCount(0);
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/account-status$/);
});

test("failed onboarding retains the form and a confirmed save with failed profile refresh reaches session recovery", async ({
  page,
}) => {
  await fixture(page, "tutor");
  let submitted = false;
  let attempts = 0;
  await page.route("**/api/v1/tutor/auth/profile", (route) =>
    submitted
      ? route.fulfill({
          status: 503,
          json: { success: false, message: "Profile unavailable" },
        })
      : route.fulfill({
          json: {
            success: true,
            data: {
              user: {
                id: 10,
                email: "new@example.test",
                status: "pending",
                role: { name: "tutor" },
              },
            },
          },
        }),
  );
  await page.route("**/api/v1/universities?*", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [{ id: 1, name: "University One" }],
        meta: { current_page: 1, last_page: 1, total: 1 },
      },
    }),
  );
  await page.route("**/api/v1/tutor/auth/complete-onboarding", (route) => {
    attempts++;
    if (attempts === 1)
      return route.fulfill({
        status: 422,
        json: {
          success: false,
          error: {
            message: "Phone already registered",
            details: { phone: ["Use another phone"] },
          },
        },
      });
    submitted = true;
    return route.fulfill({
      json: { success: true, data: { user: { id: 10, status: "pending" } } },
    });
  });
  await page.goto("/onboarding");
  for (const [name, value] of Object.entries({
    "Firstname *": "Amina",
    "Lastname *": "Creator",
    "Phone *": "+23280123456",
    "Password *": "TestPassword123!",
    "Password confirmation *": "TestPassword123!",
    "Qualification *": "Graduate",
    "Expertise area *": "Engineering",
    "Years experience *": "5",
  }))
    await page.getByLabel(name, { exact: true }).fill(value);
  await page.getByLabel("University *", { exact: true }).selectOption("1");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("Phone already registered", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByLabel("Firstname *", { exact: true })).toHaveValue(
    "Amina",
  );
  await page.getByLabel("Phone *", { exact: true }).fill("+23280123457");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(/\/account-status$/);
  await expect(
    page.getByRole("heading", {
      name: "Your session needs a connection",
      exact: true,
    }),
  ).toBeVisible();
  expect(attempts).toBe(2);
});

test("feed builder previews draft images, links and YouTube without saving and recovers from broken media", async ({
  page,
}) => {
  await fixture(page, "contributor");
  let mutations = 0;
  await page.route("**/api/v1/tutor/feed", (route) => {
    mutations++;
    return route.fulfill({
      status: 422,
      json: { success: false, message: "Test draft remains unsaved" },
    });
  });
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body>YouTube preview fixture</body></html>",
    }),
  );
  await page.route("https://media.example.test/lesson.png", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><rect width="480" height="270" fill="#eee9ff"/><text x="30" y="140" font-size="28">Lesson illustration</text></svg>',
    }),
  );
  await page.route("https://media.example.test/broken.png", (route) =>
    route.abort(),
  );
  await page.goto("/feed/new");
  await page.getByLabel("Title", { exact: true }).fill("A learning moment");
  await page.getByLabel("Type *", { exact: true }).selectOption("tip");
  await page
    .getByRole("textbox", { name: "Post content", exact: true })
    .fill("Explore this guide. ");
  await page.getByRole("button", { name: "Add link", exact: true }).click();
  await page
    .getByLabel("Post link URL")
    .fill("https://example.test/learning-guide");
  await page.getByRole("button", { name: "Insert link", exact: true }).click();
  const preview = page.getByRole("article", { name: "Feed post preview" });
  await expect(
    preview.locator(
      '.link-preview a[href="https://example.test/learning-guide"]',
    ),
  ).toBeVisible();
  await page
    .getByLabel("Media url", { exact: true })
    .fill("https://media.example.test/lesson.png");
  await expect(
    preview.getByRole("img", { name: "Media preview" }),
  ).toBeVisible();
  await page
    .getByLabel("Media url", { exact: true })
    .fill("https://youtu.be/dQw4w9WgXcQ?t=90");
  await expect(preview.locator("iframe")).toHaveAttribute(
    "src",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90",
  );
  expect(mutations).toBe(0);
  await preview.screenshot({
    path: test.info().outputPath("feed-media-desktop.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await preview.screenshot({
    path: test.info().outputPath("feed-media-mobile.png"),
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByLabel("Media url", { exact: true })
    .fill("https://media.example.test/broken.png");
  await expect(
    preview.getByText(
      "Media could not be loaded. Check the URL or open the original.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByLabel("Media url", { exact: true })
    .fill("https://media.example.test/lesson.png");
  await expect(
    preview.getByRole("img", { name: "Media preview" }),
  ).toBeVisible();
  await expect(preview.getByText(/Media could not be loaded/)).toHaveCount(0);
  await page
    .getByLabel("Media url", { exact: true })
    .fill("javascript:alert(1)");
  await expect(
    preview.getByText(
      "Enter a valid HTTP or HTTPS URL to preview this media.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(preview.locator("iframe")).toHaveCount(0);
  expect(mutations).toBe(0);
});

test("course block and cover previews support images, YouTube and unsupported embed link fallbacks", async ({
  page,
}) => {
  await fixture(page, "tutor");
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body>YouTube preview fixture</body></html>",
    }),
  );
  await page.route("https://media.example.test/cover.png", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><rect width="480" height="270" fill="#eee9ff"/></svg>',
    }),
  );
  await page.route("**/api/v1/tutor/courses/1", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          course: {
            id: 1,
            title: "Media course",
            description: "Course description",
            status: "draft",
          },
        },
      },
    }),
  );
  const tree: Record<string, unknown> = {
    "courses/1/modules": { modules: [{ id: 10, title: "Module" }] },
    "modules/10/lessons": { lessons: [{ id: 20, title: "Lesson" }] },
    "lessons/20/mini-lessons": {
      mini_lessons: [{ id: 30, title: "Mini lesson" }],
    },
    "mini-lessons/30/blocks": {
      blocks: [
        {
          id: 40,
          title: "Video block",
          content_type: "embed",
          media_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        },
      ],
    },
    "courses/1/resources": { resources: [] },
  };
  for (const [path, data] of Object.entries(tree))
    await page.route(`**/api/v1/tutor/${path}`, (route) =>
      route.fulfill({ json: { success: true, data } }),
    );
  await page.goto("/courses/1");
  await page
    .getByLabel("Thumbnail url", { exact: true })
    .fill("https://media.example.test/cover.png");
  await expect(
    page
      .getByRole("region", { name: "Course details preview" })
      .getByRole("img", { name: "Course cover" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Module", exact: true }).click();
  await page
    .getByRole("button", { name: "Discard and switch", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Expand Module", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Expand Lesson", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Expand Mini lesson", exact: true })
    .click();
  await page.getByRole("button", { name: "Video block", exact: true }).click();
  await expect(page.locator(".editor-panel iframe")).toHaveAttribute(
    "src",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  );
  await page
    .getByLabel("Media url", { exact: true })
    .fill("https://example.test/interactive-lesson");
  await expect(page.locator(".editor-panel iframe")).toHaveCount(0);
  await expect(
    page.locator(
      '.editor-panel .link-preview a[href="https://example.test/interactive-lesson"]',
    ),
  ).toBeVisible();
  await page
    .getByLabel("Content type *", { exact: true })
    .selectOption("image");
  await page
    .getByLabel("Media url", { exact: true })
    .fill("https://media.example.test/cover.png");
  await page
    .getByLabel("Media metadata", { exact: true })
    .fill('{"caption":"Circuit illustration"}');
  await expect(
    page.getByRole("img", { name: "Circuit illustration" }),
  ).toBeVisible();
  await page
    .getByLabel("Content type *", { exact: true })
    .selectOption("video");
  await page
    .getByLabel("Media url", { exact: true })
    .fill("https://youtube.com/shorts/dQw4w9WgXcQ");
  await expect(page.locator(".editor-panel iframe")).toHaveAttribute(
    "src",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  );
  await page
    .locator(".media-preview")
    .screenshot({ path: test.info().outputPath("course-media-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator(".media-preview")
    .screenshot({ path: test.info().outputPath("course-media-mobile.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

async function quizBuilderFixture(
  page: import("@playwright/test").Page,
  savedQuiz?: Record<string, unknown>,
) {
  await fixture(page, "tutor");
  await page.route("**/api/v1/tutor/courses/1", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          course: {
            id: 1,
            title: "Quiz course",
            description: "Learn",
            status: "draft",
          },
        },
      },
    }),
  );
  const tree: Record<string, unknown> = {
    "courses/1/modules": { modules: [{ id: 10, title: "Module" }] },
    "modules/10/lessons": { lessons: [{ id: 20, title: "Lesson" }] },
    "lessons/20/quizzes": { quizzes: savedQuiz ? [savedQuiz] : [] },
    "lessons/20/mini-lessons": { mini_lessons: [] },
    "courses/1/resources": { resources: [] },
  };
  for (const [path, data] of Object.entries(tree))
    await page.route(`**/api/v1/tutor/${path}`, (route) =>
      route.fulfill({ json: { success: true, data } }),
    );
  await page.goto("/courses/1");
  await page
    .getByRole("button", { name: "Expand Module", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Expand Lesson", exact: true })
    .click();
  if (savedQuiz)
    await page
      .getByRole("button", { name: String(savedQuiz.question), exact: true })
      .click();
  else
    await page
      .locator(".outline-group-head")
      .filter({
        has: page.locator("strong", {
          hasText: /^quizzes$/,
        }),
      })
      .getByRole("button", { name: "Add", exact: true })
      .click();
  await expect(page.getByLabel("Quiz type", { exact: true })).toBeVisible();
}

test("quiz creation is type aware, sends checked choices and preserves rejected drafts", async ({
  page,
}) => {
  await quizBuilderFixture(page);
  const payloads: Record<string, unknown>[] = [];
  await page.route("**/api/v1/tutor/content/quizzes", (route) => {
    payloads.push(route.request().postDataJSON());
    return route.fulfill({
      status: 422,
      json: {
        success: false,
        error: {
          message: "Quiz validation failed",
          details: { "options.0": ["Revise this choice"] },
        },
      },
    });
  });
  await page
    .getByLabel("Quiz question", { exact: true })
    .fill("Which value is correct?");
  await page.getByLabel("Choice 1", { exact: true }).fill("First");
  await page.getByLabel("Choice 2", { exact: true }).fill("Second");
  await page.getByLabel("Choice 2 is correct", { exact: true }).check();
  await page.getByLabel("Choice 2", { exact: true }).fill("Edited second");
  await page.getByText("Quiz settings (optional)", { exact: true }).click();
  await page.getByLabel("Allowed attempts", { exact: true }).fill("0");
  await page.getByText("Quiz settings (optional)", { exact: true }).click();
  await page.getByRole("button", { name: "Create quiz", exact: true }).click();
  await expect(
    page.getByText("Enter a whole number of 1 or more.", { exact: true }),
  ).toBeVisible();
  expect(payloads).toHaveLength(0);
  await page.getByLabel("Allowed attempts", { exact: true }).fill("3");
  await expect(page.getByLabel("Accepted answer", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Create quiz", exact: true }).click();
  await expect(
    page.getByText("Quiz validation failed", { exact: true }),
  ).toBeVisible();
  expect(payloads[0]).toMatchObject({
    quiz_type: "mcq",
    options: ["First", "Edited second"],
    correct_answer: ["Edited second"],
    lesson_id: 20,
    order_index: 0,
  });
  await expect(page.getByLabel("Choice 2", { exact: true })).toHaveValue(
    "Edited second",
  );
  await expect(
    page.getByText("Revise this choice", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Quiz type", { exact: true })
    .selectOption("short_answer");
  await expect(page.getByLabel("Choice 1", { exact: true })).toHaveCount(0);
  await page
    .getByLabel("Accepted answer", { exact: true })
    .fill("Short answer");
  await page.getByRole("button", { name: "Create quiz", exact: true }).click();
  await expect.poll(() => payloads.length).toBe(2);
  expect(payloads[1]).toMatchObject({
    quiz_type: "short_answer",
    options: [],
    correct_answer: ["Short answer"],
  });
  await page.getByLabel("Quiz type", { exact: true }).selectOption("one_word");
  await page.getByLabel("Accepted answer", { exact: true }).fill("two words");
  await page.getByRole("button", { name: "Create quiz", exact: true }).click();
  await expect(
    page.getByText("Use one word per answer.", { exact: true }),
  ).toBeVisible();
  expect(payloads).toHaveLength(2);
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "You have unsaved changes" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stay", exact: true }).click();
  await expect(page).toHaveURL(/\/courses\/1$/);
});

test("blank quizzes preserve spaces and ordered answers and tap-fill uses a selectable word bank", async ({
  page,
}) => {
  await quizBuilderFixture(page);
  const payloads: Record<string, unknown>[] = [];
  await page.route("**/api/v1/tutor/content/quizzes", (route) => {
    payloads.push(route.request().postDataJSON());
    return route.fulfill({
      status: 422,
      json: { success: false, message: "Keep this draft" },
    });
  });
  await page
    .getByLabel("Quiz type", { exact: true })
    .selectOption("fill_blank");
  await page
    .getByLabel("Quiz question", { exact: true })
    .fill("  begins the sequence;   follows it.  ");
  await page.getByLabel("Blank 1 answer", { exact: true }).fill("first");
  await page
    .getByRole("button", { name: "Add blank answer", exact: true })
    .click();
  await page.getByLabel("Blank 2 answer", { exact: true }).fill("second");
  await page
    .getByRole("button", { name: "Move blank answer 2 up", exact: true })
    .click();
  await page.getByRole("button", { name: "Create quiz", exact: true }).click();
  await expect.poll(() => payloads.length).toBe(1);
  expect(payloads[0]).toMatchObject({
    question: "  begins the sequence;   follows it.  ",
    correct_answer: ["second", "first"],
    options: [],
  });
  await page.getByLabel("Quiz type", { exact: true }).selectOption("tap_fill");
  await page.getByRole("button", { name: "Add word", exact: true }).click();
  await page.getByLabel("Word 1", { exact: true }).fill("first");
  await page.getByRole("button", { name: "Add word", exact: true }).click();
  await page.getByLabel("Word 2", { exact: true }).fill("second");
  await page.getByRole("button", { name: "Add word", exact: true }).click();
  await page.getByLabel("Word 3", { exact: true }).fill("distractor");
  await page
    .getByLabel("Blank 1 answer", { exact: true })
    .selectOption("second");
  await page
    .getByLabel("Blank 2 answer", { exact: true })
    .selectOption("first");
  await page.getByRole("button", { name: "Create quiz", exact: true }).click();
  await expect.poll(() => payloads.length).toBe(2);
  expect(payloads[1]).toMatchObject({
    quiz_type: "tap_fill",
    options: ["first", "second", "distractor"],
    correct_answer: ["second", "first"],
  });
  await page
    .locator(".editor-panel")
    .screenshot({ path: test.info().outputPath("quiz-tap-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator(".editor-panel")
    .screenshot({ path: test.info().outputPath("quiz-tap-mobile.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("existing quiz updates use the editor flow and uncertain saves cannot be repeated", async ({
  page,
}) => {
  await quizBuilderFixture(page, {
    id: 50,
    question: "Existing question",
    quiz_type: "mcq",
    options: ["A", "B"],
    correct_answer: ["B"],
    xp_reward: 5,
    attempts_allowed: 3,
    is_published: false,
  });
  let mutations = 0;
  await page.route("**/api/v1/tutor/content/quizzes/50", (route) => {
    mutations++;
    expect(route.request().method()).toBe("PUT");
    return route.fulfill({
      status: 503,
      json: { success: false, message: "Response unavailable" },
    });
  });
  await page.getByLabel("Choice 2", { exact: true }).fill("Updated B");
  await page.getByRole("button", { name: "Save quiz", exact: true }).click();
  await expect(page.getByText(/The save result is uncertain/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save quiz", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Choice 2", { exact: true })).toHaveValue(
    "Updated B",
  );
  await page
    .getByRole("button", { name: "Check current state", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Load saved version", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Load saved version", exact: true })
    .click();
  await expect(page.getByLabel("Choice 2", { exact: true })).toHaveValue("B");
  await expect(page.getByText(/The save result is uncertain/)).toHaveCount(0);
  expect(mutations).toBe(1);
});

test("a successful quiz creation opens the persisted editor and releases dirty navigation", async ({
  page,
}) => {
  await quizBuilderFixture(page);
  let created: Record<string, unknown> | undefined;
  await page.route("**/api/v1/tutor/content/quizzes", (route) => {
    created = {
      id: 90,
      ...route.request().postDataJSON(),
      xp_reward: 5,
      attempts_allowed: 3,
    };
    return route.fulfill({ json: { success: true, data: { quiz: created } } });
  });
  await page.route("**/api/v1/tutor/lessons/20/quizzes", (route) =>
    route.fulfill({
      json: { success: true, data: { quizzes: created ? [created] : [] } },
    }),
  );
  await page.getByLabel("Quiz type", { exact: true }).selectOption("one_word");
  await page
    .getByLabel("Quiz question", { exact: true })
    .fill("Which process uses sunlight?");
  await page
    .getByLabel("Accepted answer", { exact: true })
    .fill("photosynthesis");
  await page.getByRole("button", { name: "Create quiz", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save quiz", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Which process uses sunlight?",
      exact: true,
    }),
  ).toBeVisible();
  expect(created).toMatchObject({
    quiz_type: "one_word",
    options: [],
    correct_answer: ["photosynthesis"],
    lesson_id: 20,
  });
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("dialog", { name: "You have unsaved changes" }),
  ).toHaveCount(0);
});
