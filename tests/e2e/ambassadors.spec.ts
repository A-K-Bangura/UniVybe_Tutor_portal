import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function setup(page: Page, role = "admin") {
  await page.addInitScript(() =>
    sessionStorage.setItem("univybe.token", "fixture"),
  );
  const writes: { path: string; body: Record<string, unknown> }[] = [],
    queries: URL[] = [];
  let ambassador = {
    id: "amb-uuid",
    status: "active",
    code: "AM2026",
    student: {
      id: "student-uuid",
      name: "Amina Musa",
      email: "amina@example.test",
    },
    university: { id: 1, name: "FBC" },
    stats: {
      verified_registrations: 2,
      completed_onboardings: 1,
      activated_learners: 0,
      onboarding_conversion_rate: 50,
      learning_activation_rate: 0,
    },
    notes: "Campus lead",
  };
  let review = {
    status: "ok",
    note: null as unknown,
    reviewed_at: null as unknown,
  };
  const referral = () => ({
    id: "ref-uuid",
    student: { name: "New Learner" },
    ambassador: { id: "amb-uuid", name: "Amina Musa" },
    source: "manual",
    code_used: "AM2026",
    stage: "verified",
    verified_at: "2026-11-18",
    review,
  });
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname.replace("/api/v1/", "");
    queries.push(url);
    let data: unknown = [];
    if (path.endsWith("/check") || path.endsWith("/auth/profile"))
      data = {
        user: {
          id: 1,
          firstname: "Admin",
          lastname: "User",
          email: "a@example.test",
          phone: "076111111",
          qualification: "Degree",
          status: "approved",
          role: { name: role },
        },
      };
    else if (path === "admin/users/student-uuid")
      data = {
        user: {
          id: 41,
          uuid: "student-uuid",
          firstname: "Amina",
          lastname: "Musa",
          full_name: "Amina Musa",
          email: "amina@example.test",
          status: "active",
        },
      };
    else if (path === "admin/ambassadors/student-search")
      data = {
        students: [
          {
            id: "student-uuid",
            name: "Amina Musa",
            email: "amina@example.test",
            onboarding_completed: true,
            is_ambassador: false,
          },
          {
            id: "other",
            name: "Not ready",
            onboarding_completed: false,
            is_ambassador: false,
          },
        ],
      };
    else if (path.startsWith("admin/ambassadors")) {
      if (route.request().method() !== "GET") {
        const body = route.request().postDataJSON();
        writes.push({ path, body });
        if (path.endsWith("/deactivate")) ambassador.status = "inactive";
        else if (path.endsWith("/activate")) ambassador.status = "active";
        else ambassador = { ...ambassador, ...body };
      }
      data =
        path === "admin/ambassadors" && route.request().method() === "GET"
          ? [ambassador]
          : {
              ambassador,
              timeline: [
                { date: "2026-11-18", verified: 2, onboarded: 1, activated: 0 },
              ],
              signals: { ip_clusters: [] },
              events: [],
            };
    } else if (path === "admin/referrals/summary")
      data = {
        totals: ambassador.stats,
        ambassadors: { total: 1, active: 1 },
        by_university: [],
        timeline: [],
      };
    else if (path.startsWith("admin/referrals")) {
      if (route.request().method() !== "GET") {
        const body = route.request().postDataJSON();
        writes.push({ path, body });
        review = {
          status: body.review_status,
          note: body.note,
          reviewed_at: "2026-11-18",
        };
      }
      data =
        path === "admin/referrals" ? [referral()] : { referral: referral() };
    } else if (
      path.includes("universities") ||
      path.includes("faculties") ||
      path.includes("departments") ||
      path.includes("organizations")
    ) {
      data = [{ id: 1, name: "FBC" }];
    }
    await route.fulfill({
      json: {
        success: true,
        data,
        meta: {
          current_page: 1,
          last_page: Array.isArray(data) && !data.length ? 0 : 1,
          total: Array.isArray(data) ? data.length : 0,
          from: null,
          to: null,
        },
      },
    });
  });
  return { writes, queries };
}
test("students filter academic context, organization and level and clear incompatible tab filters", async ({
  page,
}) => {
  const { queries } = await setup(page);
  await page.goto("/users?user_type=student&status=&page=2");
  await page.getByLabel("University filter", { exact: true }).selectOption("1");
  await page.getByLabel("Faculty filter", { exact: true }).selectOption("1");
  await page.getByLabel("Department filter", { exact: true }).selectOption("1");
  await page
    .getByLabel("Organization filter", { exact: true })
    .selectOption("1");
  await page.getByLabel("Student level filter").selectOption("UnderGrad");
  await page.getByLabel("Filter by status").selectOption("active");
  await expect
    .poll(() =>
      queries
        .filter((u) => u.pathname.endsWith("/admin/users"))
        .at(-1)
        ?.searchParams.get("status"),
    )
    .toBe("active");
  const query = queries
    .filter((u) => u.pathname.endsWith("/admin/users"))
    .at(-1)!;
  for (const k of [
    "university_id",
    "faculty_id",
    "department_id",
    "organization_id",
  ])
    expect(query.searchParams.get(k)).toBe("1");
  expect(query.searchParams.get("level")).toBe("UnderGrad");
  expect(query.searchParams.has("page")).toBe(false);
  await page.getByRole("tab", { name: "Creator users" }).click();
  await expect(page).not.toHaveURL(/level=/);
  await page.getByRole("tab", { name: "Students", exact: true }).click();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByLabel("Organization filter")).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
});
test("admin designates eligible students and edits campus notes and activation", async ({
  page,
}) => {
  const { writes } = await setup(page, "super_admin");
  await page.goto("/ambassadors/new");
  await page.getByLabel("Find student").fill("Amina");
  await page.getByRole("button", { name: "Search students" }).click();
  await expect(
    page.getByRole("button", { name: "Onboarding incomplete" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Select student" }).click();
  await page.getByLabel("Custom code (optional)").fill("AM2026");
  await page.getByLabel("Admin notes").fill("Campus lead");
  await page
    .getByRole("button", { name: "Designate ambassador", exact: true })
    .click();
  await expect(page).toHaveURL(/ambassadors\/amb-uuid/);
  await expect(
    page.getByRole("heading", { name: "Manage ambassador", exact: true }),
  ).toBeVisible();
  expect(writes[0].body).toEqual({
    student_id: "student-uuid",
    code: "AM2026",
    notes: "Campus lead",
  });
  await page.getByLabel("Admin notes").fill("Updated note");
  await page.getByRole("button", { name: "Save campus and notes" }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].body).toEqual({ university_id: 1, notes: "Updated note" });
  await page.getByLabel("Deactivation reason (optional)").fill("Term ended");
  await page.getByRole("button", { name: "Deactivate ambassador" }).click();
  await expect(
    page.getByRole("button", { name: "Activate ambassador", exact: true }),
  ).toBeVisible();
  expect(writes[2].body).toEqual({ reason: "Term ended" });
});
test("referral summary, filters and required review note preserve attribution", async ({
  page,
}) => {
  const { writes, queries } = await setup(page);
  await page.goto("/referrals");
  await expect(
    page.getByRole("heading", { name: "Campus and cohort summary" }),
  ).toBeVisible();
  await page
    .getByLabel("Review status", { exact: true })
    .selectOption("flagged");
  await expect
    .poll(() =>
      queries
        .filter((u) => u.pathname.endsWith("/admin/referrals"))
        .at(-1)
        ?.searchParams.get("review_status"),
    )
    .toBe("flagged");
  await page.getByRole("link", { name: "View details", exact: true }).click();
  await page
    .getByLabel("Review status", { exact: true })
    .selectOption("invalidated");
  await page.getByRole("button", { name: "Save review" }).click();
  expect(writes).toHaveLength(0);
  await page.getByLabel("Review note").fill("Duplicate verified by team");
  await page.getByRole("button", { name: "Save review" }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].body).toEqual({
    review_status: "invalidated",
    note: "Duplicate verified by team",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const result = await new AxeBuilder({ page }).include("main").analyze();
  expect(
    result.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact || ""),
    ),
  ).toEqual([]);
});
test("tutors cannot access ambassador administration", async ({ page }) => {
  const { queries } = await setup(page, "tutor");
  await page.goto("/ambassadors");
  await expect(
    page.getByRole("heading", { name: "Access restricted" }),
  ).toBeVisible();
  expect(queries.some((u) => u.pathname.includes("admin/ambassadors"))).toBe(
    false,
  );
});

test("student profile opens designation with the student selected and compact responsive actions", async ({
  page,
}, testInfo) => {
  const { writes, queries } = await setup(page);
  await page.goto("/users/student-uuid");
  await page
    .getByRole("link", { name: "Designate ambassador", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Designate Amina Musa", exact: true }),
  ).toBeVisible();
  expect(queries.some((u) => u.pathname.endsWith("student-search"))).toBe(
    false,
  );
  await expect(page.getByLabel("Find student")).toHaveCount(0);
  const button = page.getByRole("button", {
    name: "Designate ambassador",
    exact: true,
  });
  const box = await button.boundingBox();
  expect(box!.height).toBeLessThan(60);
  expect(box!.width).toBeLessThan(300);
  await page.screenshot({
    path: testInfo.outputPath("designation-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("designation-mobile.png"),
    fullPage: true,
  });
  const axe = await new AxeBuilder({ page }).include("main").analyze();
  expect(
    axe.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact || ""),
    ),
  ).toEqual([]);
  await button.click();
  await expect(page).toHaveURL(/ambassadors\/amb-uuid/);
  expect(writes[0].body).toEqual({ student_id: "student-uuid", notes: null });
});
