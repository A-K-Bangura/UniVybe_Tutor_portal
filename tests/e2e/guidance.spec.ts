import { test, expect, type Page } from "@playwright/test";
async function fixture(page: Page, role = "moderator") {
  await page.addInitScript(() =>
    sessionStorage.setItem("univybe.token", "fixture"),
  );
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  let guide: Record<string, unknown> = {
    id: "guide-1",
    name: "Aminata",
    whatsapp_number: "+23276555111",
    description: "",
    approval_status: "pending",
    is_active: true,
    is_matchable: false,
    categories: [{ id: 1, name: "Admissions" }],
    coverage: [{ scope: "platform", label: "All universities" }],
  };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    let data: unknown = [];
    if (path.endsWith("/auth/profile") || path.endsWith("/check"))
      data = {
        user: {
          id: 1,
          email: "test@example.test",
          firstname: "Test",
          lastname: "Creator",
          phone: "076111111",
          qualification: "Degree",
          status: "approved",
          role: { name: role },
        },
      };
    else if (path.endsWith("/guides/options"))
      data = {
        categories: [{ id: 1, name: "Admissions" }],
        max_coverage_per_guide: 30,
      };
    else if (path.includes("/guidance/guides")) {
      if (method !== "GET") {
        const body = route.request().postDataJSON() || {};
        writes.push({ path, body });
        if (path.endsWith("/approve"))
          guide = { ...guide, approval_status: "approved", is_matchable: true };
        else guide = { ...guide, ...body };
      }
      data = path.endsWith("/guides") && method === "GET" ? [guide] : { guide };
    } else if (path.endsWith("/categories"))
      data = {
        categories: [
          {
            id: 1,
            name: "General",
            is_reserved: true,
            is_active: true,
            required_context: "none",
            guides_count: 1,
            inquiries_count: 2,
          },
        ],
      };
    else if (path.endsWith("/settings")) {
      if (method === "PUT")
        writes.push({ path, body: route.request().postDataJSON() });
      data = { settings: null, is_configured: false, history: [] };
    } else if (path.endsWith("/inquiries/summary"))
      data = {
        totals: { routed: 1, to_guides: 0, to_central: 1 },
        by_category: [],
        by_guide: [],
        by_match_tier: [],
      };
    else if (path.endsWith("/inquiries"))
      data = [
        {
          id: "route-1",
          category: { name: "Admissions" },
          student: { name: "Student" },
          is_central_fallback: true,
          source: "general",
          match_tier: "central",
        },
      ];
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
test("moderator submits a consented guide and cannot enter administration", async ({
  page,
}) => {
  const writes = await fixture(page);
  await page.goto("/guidance/new");
  await page.getByLabel("Guide name *", { exact: true }).fill("Aminata");
  await page
    .getByLabel("WhatsApp number *", { exact: true })
    .fill("076 555 111");
  await page.getByRole("checkbox", { name: "Admissions" }).check();
  await page.getByLabel("Coverage scope").selectOption("platform");
  await page.getByRole("button", { name: "Add place", exact: true }).click();
  await page.getByRole("checkbox", { name: /This person agreed/ }).check();
  await page.getByRole("button", { name: "Submit guide", exact: true }).click();
  await expect(page).toHaveURL(/guidance\/guide-1$/);
  expect(writes[0].body).toMatchObject({
    category_ids: [1],
    coverage: [{ all_universities: true }],
    consent_confirmed: true,
  });
  await expect(page.getByText(/Not available to students/)).toBeVisible();
  await page.goto("/guidance-admin/guides");
  await expect(
    page.getByRole("heading", { name: "Access restricted" }),
  ).toBeVisible();
});
test("admin reviews guide and protected categories; history describes contacts", async ({
  page,
}) => {
  const writes = await fixture(page, "admin");
  await page.goto("/guidance-admin/guides/guide-1");
  await page
    .getByRole("button", { name: "Approve guide", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm action" }).click();
  await expect(page.getByText(/Approval: approved/)).toBeVisible();
  expect(writes[0].path).toContain("/admin/guidance/guides/guide-1/approve");
  await page.goto("/guidance-admin/categories");
  await expect(
    page.getByRole("button", { name: "Delete category" }),
  ).toBeDisabled();
  await page.goto("/guidance-admin/inquiries");
  await expect(
    page.getByRole("heading", { name: "Contacts provided" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Student · Central UniVybe contact/),
  ).toBeVisible();
});

test("approved guide edits send only changes, keep live details and show proposals", async ({
  page,
}) => {
  await fixture(page, "tutor");
  const live = {
    id: "guide-1",
    name: "Aminata",
    whatsapp_number: "+23276555111",
    description: "",
    approval_status: "approved",
    is_active: true,
    is_matchable: true,
    categories: [{ id: 1, name: "Admissions" }],
    coverage: [{ scope: "platform", label: "All universities" }],
  };
  let current: Record<string, unknown> = live;
  let body: Record<string, unknown> = {};
  await page.route("**/api/v1/tutor/guidance/guides/guide-1", async (route) => {
    if (route.request().method() === "PUT") {
      body = route.request().postDataJSON();
      current = {
        ...live,
        has_pending_changes: true,
        pending_changes: { fields: ["name"], name: body.name },
      };
    }
    await route.fulfill({
      json: {
        success: true,
        message: "Changes awaiting review",
        data: { guide: current, queued_fields: ["name"] },
      },
    });
  });
  await page.goto("/guidance/guide-1");
  await page.getByRole("button", { name: "Edit guide", exact: true }).click();
  await page
    .getByLabel("Guide name *", { exact: true })
    .fill("Aminata Updated");
  await page.getByRole("button", { name: "Save guide", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Proposed changes awaiting review" }),
  ).toBeVisible();
  expect(body).toEqual({ name: "Aminata Updated" });
  await expect(
    page.getByRole("heading", { name: "Aminata", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Withdraw guide" }),
  ).toHaveCount(0);
});

test("number changes require renewed consent and server validation retains the draft", async ({
  page,
}) => {
  await fixture(page, "tutor");
  let attempts = 0;
  let body: Record<string, unknown> = {};
  await page.route("**/api/v1/tutor/guidance/guides/guide-1", async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    attempts++;
    body = route.request().postDataJSON();
    await route.fulfill({
      status: 422,
      json: {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Number already registered",
          details: { whatsapp_number: ["Choose another number."] },
        },
      },
    });
  });
  await page.goto("/guidance/guide-1");
  await page.getByRole("button", { name: "Edit guide", exact: true }).click();
  await page
    .getByLabel("WhatsApp number *", { exact: true })
    .fill("076 555 999");
  await page.getByRole("button", { name: "Save guide", exact: true }).click();
  expect(attempts).toBe(0);
  await page.getByRole("checkbox", { name: /This person agreed/ }).check();
  await page.getByRole("button", { name: "Save guide", exact: true }).click();
  await expect(page.getByText("Number already registered")).toBeVisible();
  expect(body).toEqual({
    whatsapp_number: "076 555 999",
    consent_confirmed: true,
  });
  await expect(
    page.getByLabel("WhatsApp number *", { exact: true }),
  ).toHaveValue("076 555 999");
});

test("admin configures the runtime central contact", async ({ page }) => {
  const writes = await fixture(page, "admin");
  await page.goto("/guidance-admin/settings");
  await page
    .getByLabel("Central WhatsApp number *", { exact: true })
    .fill("076 111 222");
  await page.getByLabel("Note", { exact: true }).fill("Support desk");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].body).toEqual({
    central_whatsapp: "076 111 222",
    note: "Support desk",
  });
});
