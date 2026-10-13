import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const options = {
  pricing_types: [
    { value: "fixed", label: "Fixed price" },
    { value: "negotiable", label: "Negotiable" },
  ],
  work_modes: [
    { value: "remote", label: "Remote" },
    { value: "physical", label: "Physical" },
    { value: "hybrid", label: "Hybrid" },
  ],
  capacity_types: [
    { value: "open", label: "Open (no limit)" },
    { value: "limited", label: "Limited" },
  ],
  currency: "SLE",
  limits: { max_skills: 15, max_tags: 15, max_applicant_limit: 10000 },
  rating: { review_max_length: 2000 },
};
const permissions = {
  can_edit: true,
  can_submit: true,
  can_delete: true,
  can_manage_settings: true,
  can_close: false,
  can_reopen: false,
  can_view_applicants: true,
  can_rate_workers: false,
};
const sample = {
  id: 1,
  uuid: "gig-1",
  title: "Design a bakery logo",
  short_description: "A simple bakery logo",
  status: "rejected",
  is_accepting_interest: false,
  category: { id: 1, name: "Design" },
  pricing_type: "fixed",
  price_amount: 500,
  price_label: "Le 500",
  work_mode: "remote",
  capacity_type: "open",
  applicant_count: 0,
  spots_remaining: null,
  contact: { email: "bakery@example.test", whatsapp: null },
  application_deadline: "2027-12-31T19:45:32+00:00",
  rejection_reason: "Include file formats",
  permissions,
  updated_at: "2026-10-07T09:00:00Z",
};
const meta = { total: 0, current_page: 1, last_page: 1, per_page: 15 };
async function fixture(page: Page, role = "tutor") {
  const user = {
    id: "user-1",
    firstname: "Amina",
    lastname: "Creator",
    email: "account@example.test",
    phone: "+23276123456",
    qualification: "Degree",
    status: "approved",
    role: { name: role },
  };
  await page.addInitScript(() =>
    sessionStorage.setItem("univybe.token", "fixture-token"),
  );
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const data =
      path.endsWith("/auth/profile") || path.endsWith("/check")
        ? { user }
        : path.endsWith("/gigs/options")
          ? options
          : path.endsWith("/gigs/categories") ||
              path.endsWith("/gig-categories")
            ? {
                categories: [
                  {
                    id: 1,
                    name: "Design",
                    slug: "design",
                    is_active: true,
                    gigs_count: 1,
                    sort_order: 0,
                  },
                ],
              }
            : [];
    return route.fulfill({ json: { success: true, data, meta } });
  });
}
test("gig draft errors preserve fields and contact errors; dirty navigation stays", async ({
  page,
}) => {
  await fixture(page);
  let body: Record<string, unknown> = {};
  await page.route("**/api/v1/tutor/gigs", (route) => {
    body = route.request().postDataJSON();
    return route.fulfill({
      status: 422,
      json: {
        success: false,
        error: {
          message: "Validation failed",
          details: { contact: ["Provide a contact method"] },
        },
      },
    });
  });
  await page.goto("/gigs/new");
  await expect(page.getByLabel("Contact email", { exact: true })).toHaveValue(
    "",
  );
  await expect(
    page.getByLabel("Contact WhatsApp", { exact: true }),
  ).toHaveValue("");
  await page.getByLabel("Title *", { exact: true }).fill("Keep my gig draft");
  await page.getByLabel("Short description *").fill("Small job");
  await page.getByLabel("Category *", { exact: true }).selectOption("1");
  await page.getByLabel("Price amount (SLE) *").fill("300.50");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByText("contact: Provide a contact method", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Title *", { exact: true })).toHaveValue(
    "Keep my gig draft",
  );
  expect(body).toMatchObject({
    title: "Keep my gig draft",
    price_amount: 300.5,
    submit: false,
    work_mode: "remote",
    contact_email: null,
  });
  expect(body).not.toHaveProperty("applicant_limit");
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Unsaved gig changes" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stay", exact: true }).click();
  await expect(page).toHaveURL(/gigs\/new/);
});
test("rejected edits preserve deadline; explicit resubmission locks creator content", async ({
  page,
}) => {
  await fixture(page, "contributor");
  let gig = { ...sample };
  const requests: Record<string, unknown>[] = [];
  await page.route("**/api/v1/tutor/gigs/gig-1", (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      requests.push(body);
      gig = {
        ...gig,
        title: body.title,
        updated_at: `version-${requests.length}`,
        ...(body.submit
          ? {
              status: "pending_approval",
              rejection_reason: "",
              permissions: {
                ...permissions,
                can_edit: false,
                can_submit: false,
                can_manage_settings: false,
                can_delete: false,
              },
            }
          : {}),
      };
    }
    return route.fulfill({ json: { success: true, data: { gig } } });
  });
  await page.goto("/gigs/gig-1");
  await page.getByLabel("Title *", { exact: true }).fill("Deliver PNG and SVG");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Deliver PNG and SVG", exact: true }),
  ).toBeVisible();
  expect(requests[0]).not.toHaveProperty("application_deadline");
  expect(requests[0].submit).toBe(false);
  await expect(
    page.getByText("Needs changes: Include file formats"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save and submit for approval", exact: true })
    .click();
  await expect(page.getByLabel("Title *", { exact: true })).toHaveCount(0);
  expect(requests[1].submit).toBe(true);
  await expect(
    page.getByText("Needs changes: Include file formats"),
  ).toHaveCount(0);
});
test("full published gig uses server closure and reopens with higher capacity and cleared deadline", async ({
  page,
}) => {
  await fixture(page);
  let gig = {
    ...sample,
    status: "published",
    applicant_count: 3,
    capacity_type: "limited",
    applicant_limit: 3,
    spots_remaining: 0,
    closed_reason: "capacity_reached",
    permissions: {
      ...permissions,
      can_edit: false,
      can_submit: false,
      can_delete: false,
      can_reopen: true,
      can_close: true,
    },
  };
  let body: Record<string, unknown> = {};
  await page.route("**/api/v1/tutor/gigs/gig-1", (route) =>
    route.fulfill({ json: { success: true, data: { gig } } }),
  );
  await page.route("**/api/v1/tutor/gigs/gig-1/reopen", (route) => {
    expect(route.request().method()).toBe("POST");
    body = route.request().postDataJSON();
    gig = {
      ...gig,
      is_accepting_interest: true,
      spots_remaining: 2,
      updated_at: "reopened",
    };
    return route.fulfill({ json: { success: true, data: { gig } } });
  });
  await page.goto("/gigs/gig-1");
  await expect(
    page.getByText("Not accepting interest: capacity reached", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reopen gig", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Reopen gig" });
  await dialog.getByLabel("Applicant limit *").fill("5");
  await dialog.getByLabel("Application deadline", { exact: true }).fill("");
  await dialog.getByRole("button", { name: "Reopen gig", exact: true }).click();
  await expect(
    page.getByText("Accepting interest", { exact: true }),
  ).toBeVisible();
  expect(body).toMatchObject({
    capacity_type: "limited",
    applicant_limit: 5,
    application_deadline: null,
  });
});
test("applicants use interest UUID, ratings replace, reviews use student UUID", async ({
  page,
}) => {
  await fixture(page);
  const gig = {
    ...sample,
    status: "published",
    permissions: {
      ...permissions,
      can_edit: false,
      can_submit: false,
      can_rate_workers: true,
    },
  };
  let applicant = {
    id: "interest-uuid",
    student: {
      id: "student-uuid",
      name: "Sorie Turay",
      bio: "Design student",
      interests: ["branding"],
      gig_rating: { average_rating: null, rating_count: 0 },
    },
    worked_with: false,
    rating_given: null as null | { rating: number; review: string },
  };
  const calls: string[] = [];
  await page.route("**/api/v1/tutor/gigs/gig-1", (route) =>
    route.fulfill({ json: { success: true, data: { gig } } }),
  );
  await page.route("**/api/v1/tutor/gigs/gig-1/applicants**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "PUT") {
      calls.push(path);
      if (path.endsWith("/worked-with"))
        applicant = { ...applicant, worked_with: true };
      else
        applicant = {
          ...applicant,
          rating_given: route.request().postDataJSON(),
        };
    }
    return route.fulfill({
      json: {
        success: true,
        data: route.request().method() === "GET" ? [applicant] : { applicant },
        meta: { ...meta, total: 1 },
      },
    });
  });
  await page.route("**/api/v1/gigs/students/student-uuid/reviews**", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          gig_rating: { average_rating: 5, rating_count: 1 },
          reviews: [{ rating: 5, review: "Great work", as: "worker" }],
        },
        meta: { ...meta, total: 1 },
      },
    }),
  );
  await page.goto("/gigs/gig-1");
  await expect(
    page.getByRole("button", { name: "Rate student", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Mark Worked With", exact: true })
    .click();
  await page.getByRole("button", { name: "Rate student", exact: true }).click();
  await page.getByLabel("Rating *", { exact: true }).selectOption("5");
  await page.getByLabel("Review", { exact: true }).fill("Great work");
  await page.getByRole("button", { name: "Save rating", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit rating", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Undo Worked With", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Edit rating", exact: true }).click();
  await page.getByLabel("Rating *", { exact: true }).selectOption("4");
  await page
    .getByRole("button", { name: "Update rating", exact: true })
    .click();
  await expect(
    page.getByText("Your rating: 4 / 5 — Great work", { exact: true }),
  ).toBeVisible();
  expect(calls).toEqual([
    "/api/v1/tutor/gigs/gig-1/applicants/interest-uuid/worked-with",
    "/api/v1/tutor/gigs/gig-1/applicants/interest-uuid/rating",
    "/api/v1/tutor/gigs/gig-1/applicants/interest-uuid/rating",
  ]);
  await page
    .getByRole("button", { name: "View student reviews", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Great work", { exact: true }),
  ).toBeVisible();
});
test("admin reviews audit sibling, has no draft publish shortcut or worker rating rights", async ({
  page,
}) => {
  await fixture(page, "admin");
  let gig = {
    ...sample,
    status: "pending_approval",
    permissions: { ...permissions, can_submit: false },
    rejection_reason: "",
  };
  let action = "";
  await page.route("**/api/v1/admin/gigs/gig-1", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          gig,
          events: [
            {
              event: "submitted",
              by: { name: "Gig creator" },
              at: "2026-10-07",
            },
          ],
        },
      },
    }),
  );
  await page.route("**/api/v1/admin/gigs/gig-1/approve", (route) => {
    action = route.request().method();
    gig = { ...gig, status: "published", updated_at: "approved" };
    return route.fulfill({ json: { success: true, data: { gig } } });
  });
  await page.goto("/reviews/gigs/gig-1");
  await expect(page.getByText("submitted", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Mark Worked With" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Approve gig", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unpublish", exact: true }),
  ).toBeVisible();
  expect(action).toBe("PUT");
  gig = { ...gig, status: "draft" };
  await page.reload();
  await expect(
    page.getByRole("heading", { name: sample.title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve", exact: true }),
  ).toHaveCount(0);
});
test("category in-use conflict stays visible; deactivation sends only changed field", async ({
  page,
}) => {
  await fixture(page, "admin");
  let deactivated = false;
  await page.route("**/api/v1/admin/gig-categories/1", (route) => {
    if (route.request().method() === "DELETE")
      return route.fulfill({
        status: 409,
        json: {
          success: false,
          error: {
            code: "GIG_CATEGORY_IN_USE",
            message: "Used category; deactivate it instead",
          },
        },
      });
    expect(route.request().postDataJSON()).toEqual({ is_active: false });
    deactivated = true;
    return route.fulfill({
      json: { success: true, data: { category: { id: 1 } } },
    });
  });
  await page.goto("/gig-categories");
  await page
    .getByRole("button", { name: "Delete category", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete category", exact: true })
    .click();
  await expect(
    page.getByText("Used category; deactivate it instead", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Deactivate", exact: true }).click();
  await expect.poll(() => deactivated).toBe(true);
});
test("moderator gig direct routes are denied; mobile gig form fits and has accessible controls", async ({
  page,
}, testInfo) => {
  await fixture(page, "moderator");
  for (const path of [
    "/gigs",
    "/gigs/new",
    "/reviews/gigs",
    "/gig-categories",
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Access restricted" }),
    ).toBeVisible();
  }
  await page.unroute("**/api/v1/**");
  await fixture(page, "educator");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/gigs/new");
  await expect(
    page.getByRole("heading", { name: "Create gig", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact || ""),
    ),
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("gigs-mobile.png"),
    fullPage: true,
  });
});

test("admin own gig submits through tutor API and remains pending approval", async ({
  page,
}) => {
  await fixture(page, "admin");
  let body: Record<string, unknown> = {};
  const gig = {
    ...sample,
    status: "pending_approval",
    rejection_reason: "",
    permissions: { ...permissions, can_submit: false },
  };
  await page.route("**/api/v1/tutor/gigs", (route) => {
    body = route.request().postDataJSON();
    return route.fulfill({
      status: 201,
      json: { success: true, data: { gig } },
    });
  });
  await page.route("**/api/v1/tutor/gigs/gig-1", (route) =>
    route.fulfill({ json: { success: true, data: { gig } } }),
  );
  await page.goto("/gigs/new");
  await page.getByLabel("Title *", { exact: true }).fill("Admin's gig");
  await page
    .getByLabel("Short description *", { exact: true })
    .fill("New small job");
  await page.getByLabel("Category *", { exact: true }).selectOption("1");
  await page
    .getByLabel("Pricing type *", { exact: true })
    .selectOption("negotiable");
  await page
    .getByLabel("Contact email", { exact: true })
    .fill("gig@example.test");
  await page
    .getByRole("button", { name: "Save and submit for approval", exact: true })
    .click();
  await expect(page).toHaveURL(/gigs\/gig-1/);
  await expect(
    page.getByText("pending approval", { exact: true }),
  ).toBeVisible();
  expect(body).toMatchObject({
    submit: true,
    pricing_type: "negotiable",
    price_amount: null,
    contact_email: "gig@example.test",
  });
  expect(body).not.toHaveProperty("status");
  await expect(
    page.getByRole("button", { name: "Approve", exact: true }),
  ).toBeVisible();
});

test("admin queue filters retain creator type and pagination, deleted gigs stay read-only", async ({
  page,
}, testInfo) => {
  await fixture(page, "admin");
  const calls: URLSearchParams[] = [];
  const deleted = { ...sample, deleted_at: "2026-10-07", title: "Deleted gig" };
  await page.route("**/api/v1/admin/gigs?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    calls.push(params);
    return route.fulfill({
      json: {
        success: true,
        data: [deleted],
        meta: {
          ...meta,
          total: 16,
          last_page: 2,
          current_page: Number(params.get("page") || 1),
        },
      },
    });
  });
  await page.route("**/api/v1/admin/gigs/gig-1", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          gig: deleted,
          events: [
            { event: "deleted", by: { name: "Admin" }, at: "2026-10-07" },
          ],
        },
      },
    }),
  );
  await page.goto("/reviews/gigs");
  await expect(
    page.getByRole("heading", { name: "Gig review queue" }),
  ).toBeVisible();
  await expect.poll(() => calls.at(-1)?.get("status")).toBe("pending_approval");
  await page.getByLabel("Status", { exact: true }).selectOption("all");
  await page
    .getByLabel("Creator type", { exact: true })
    .selectOption("student");
  await page.getByLabel("Creator ID").fill("4");
  await page
    .getByLabel("Deleted records", { exact: true })
    .selectOption("with");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect.poll(() => calls.at(-1)?.get("creator_id")).toBe("4");
  expect(calls.at(-1)?.get("creator_type")).toBe("student");
  expect(calls.at(-1)?.has("status")).toBe(false);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect.poll(() => calls.at(-1)?.get("page")).toBe("2");
  expect(calls.at(-1)?.get("trashed")).toBe("with");
  await page.screenshot({
    path: testInfo.outputPath("gigs-queue-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Deleted gig", exact: true }).click();
  await expect(
    page.getByText(
      "This gig was deleted. Its details and audit history are read-only.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Title *", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Restore", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Delete gig", exact: true }),
  ).toHaveCount(0);
});

test("plain Laravel policy errors retain draft and admin closure prevents creator reopening", async ({
  page,
}) => {
  await fixture(page);
  let gig = { ...sample, closed_by_role: "creator" };
  await page.route("**/api/v1/tutor/gigs/gig-1", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({
          status: 403,
          json: { message: "This gig is waiting for admin review" },
        })
      : route.fulfill({ json: { success: true, data: { gig } } }),
  );
  await page.goto("/gigs/gig-1");
  await page
    .getByLabel("Title *", { exact: true })
    .fill("Keep after policy denial");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("This gig is waiting for admin review", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Title *", { exact: true })).toHaveValue(
    "Keep after policy denial",
  );
  gig = {
    ...gig,
    status: "closed",
    closed_by_role: "admin",
    permissions: {
      ...permissions,
      can_edit: false,
      can_submit: false,
      can_reopen: false,
    },
  };
  await page.reload();
  await expect(
    page.getByText("Closed by an admin. Only an admin can reopen it."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reopen gig", exact: true }),
  ).toHaveCount(0);
});
