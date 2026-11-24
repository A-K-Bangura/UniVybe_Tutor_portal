import { test, expect, type Page } from "@playwright/test";
async function setup(page: Page, role = "admin") {
  await page.addInitScript(() =>
    sessionStorage.setItem("univybe.token", "fixture"),
  );
  const writes: { path: string; body: Record<string, unknown> }[] = [],
    urls: URL[] = [];
  let preview = 0,
    closed = false;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname.replace("/api/v1/", "");
    urls.push(url);
    let data: unknown = [];
    const period = {
      id: 1,
      name: "2026/2027 Semester 1",
      type: "semester",
      status: closed ? "closed" : "active",
      university_id: 1,
      academic_year: "2026/2027",
      semester: 1,
    };
    if (path.endsWith("/check") || path.endsWith("/auth/profile"))
      data = {
        user: {
          id: 1,
          email: "admin@example.test",
          firstname: "Admin",
          lastname: "User",
          phone: "076111111",
          qualification: "Degree",
          status: "approved",
          role: { name: role },
        },
      };
    else if (path.endsWith("/closure-preview"))
      data = {
        period,
        impact: { students_affected: ++preview, unused_unlocks: 5 },
        warnings: ["Pending checkouts may arrive late."],
        confirmation_code: `code-${preview}`,
      };
    else if (path.endsWith("/close")) {
      const body = route.request().postDataJSON();
      writes.push({ path, body });
      if (writes.filter((w) => w.path.endsWith("/close")).length === 1)
        return route.fulfill({
          status: 409,
          json: {
            success: false,
            error: {
              code: "CLOSURE_IMPACT_CHANGED",
              message: "Impact changed. Review again.",
              details: {
                confirmation_code: "new-code",
                impact: { students_affected: 2 },
              },
            },
          },
        });
      closed = true;
      data = { period: { ...period, status: "closed" } };
    } else if (
      path === "admin/academic-periods" &&
      route.request().method() === "POST"
    ) {
      writes.push({ path, body: route.request().postDataJSON() });
      data = { period };
    } else if (path === "admin/academic-periods/1") data = { period };
    else if (path.startsWith("admin/course-packs")) {
      if (route.request().method() !== "GET")
        writes.push({ path, body: route.request().postDataJSON() });
      data =
        path === "admin/course-packs" && route.request().method() === "GET"
          ? []
          : {
              pack: {
                id: 2,
                name: "Study pack",
                price: 100,
                promo_price: 80,
                promo_starts_at: "2026-11-24T14:30:00+00:00",
                promo_ends_at: "2026-11-26T14:30:00+00:00",
                validity_type: "semester",
                unlock_count: 3,
                is_active: true,
              },
            };
    } else if (path === "universities") data = [{ id: 1, name: "FBC" }];
    await route.fulfill({
      json: {
        success: true,
        data,
        summary: { revenue: 100, unlocks_remaining: 3, needs_attention: 2 },
        meta: {
          current_page: 1,
          last_page: 1,
          total: Array.isArray(data) ? data.length : 0,
        },
      },
    });
  });
  return { writes, urls };
}
test("closure requires typed confirmation and re-confirms changed impact", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.goto("/academic-periods/1");
  await page.getByRole("button", { name: "Preview closure" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Pending checkouts may arrive late."),
  ).toBeVisible();
  const close = dialog.getByRole("button", {
    name: "Close period permanently",
  });
  await expect(close).toBeDisabled();
  await dialog.getByLabel("Type CLOSE to confirm").fill("CLOSE");
  await close.click();
  await expect(dialog.getByText("Impact changed. Review again.")).toBeVisible();
  await expect(dialog.getByLabel("Type CLOSE to confirm")).toHaveValue("");
  await expect(close).toBeDisabled();
  await dialog.getByLabel("Type CLOSE to confirm").fill("CLOSE");
  await close.click();
  await expect(dialog).toHaveCount(0);
  expect(writes[0].body.confirmation_code).toMatch(/^code-/);
  expect(writes[1].body.confirmation_code).not.toBe(
    writes[0].body.confirmation_code,
  );
  await expect(
    page.getByRole("button", { name: "Preview closure" }),
  ).toHaveCount(0);
});
test("pack edits clear promotion and submit only writable fields", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.goto("/course-packs/2");
  await page.getByLabel("Promo price", { exact: true }).fill("");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].body).toMatchObject({
    promo_price: null,
    promo_starts_at: null,
    promo_ends_at: null,
  });
  expect(writes[0].body).not.toHaveProperty("sales");
});
test("reports send supported filters and enforce admin access", async ({
  page,
}) => {
  const { urls } = await setup(page);
  await page.goto("/course-access?student_id=41");
  await page
    .getByRole("button", { name: "Needs attention", exact: true })
    .click();
  await expect
    .poll(() =>
      urls
        .filter((u) => u.pathname.endsWith("/course-access"))
        .at(-1)
        ?.searchParams.get("needs_attention"),
    )
    .toBe("1");
  expect(
    urls
      .filter((u) => u.pathname.endsWith("/course-access"))
      .at(-1)
      ?.searchParams.get("student_id"),
  ).toBe("41");
  await page.goto("/course-pack-purchases");
  await page
    .getByLabel("status filter", { exact: true })
    .selectOption("succeeded");
  await expect
    .poll(() =>
      urls
        .filter((u) => u.pathname.endsWith("/course-pack-purchases"))
        .at(-1)
        ?.searchParams.get("status"),
    )
    .toBe("succeeded");
});
test("tutors cannot manage periods or packs", async ({ page }) => {
  const { urls } = await setup(page, "tutor");
  await page.goto("/academic-periods");
  await expect(
    page.getByRole("heading", { name: "Access restricted" }),
  ).toBeVisible();
  expect(urls.some((u) => u.pathname.includes("/admin/academic-periods"))).toBe(
    false,
  );
});

test("academic periods use numeric semester independently of course semester names", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.goto("/academic-periods/new");
  await page.getByLabel("University *", { exact: true }).selectOption("1");
  await page.getByLabel("Academic year *", { exact: true }).fill("2026/2027");
  await page.getByLabel("Period semester", { exact: true }).fill("3");
  await page
    .getByRole("button", { name: "Create period", exact: true })
    .click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].body).toMatchObject({
    type: "semester",
    semester: 3,
    university_id: 1,
  });
  expect(writes[0].body).not.toHaveProperty("period_semester");
});

test.describe("promotion date and time pickers", () => {
  test.use({ timezoneId: "America/New_York" });
  test("loads local times and saves explicit UTC timestamps", async ({
    page,
  }) => {
    const { writes } = await setup(page);
    await page.goto("/course-packs/2");
    const start = page.getByLabel("Promo starts at", { exact: true }),
      end = page.getByLabel("Promo ends at", { exact: true });
    await expect(start).toHaveAttribute("type", "datetime-local");
    await expect(end).toHaveAttribute("type", "datetime-local");
    await expect(start).toHaveValue("2026-11-24T09:30");
    await start.fill("2026-11-24T10:15");
    await end.fill("2026-11-27T17:45");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].body).toMatchObject({
      promo_starts_at: "2026-11-24T15:15:00.000Z",
      promo_ends_at: "2026-11-27T22:45:00.000Z",
    });
  });
});

test("wheel scrolling preserves focused prices and custom numeric filters", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/course-packs/2");
  const price = page.getByLabel("Price *", { exact: true });
  await price.fill("123.45");
  await price.hover();
  await page.mouse.wheel(0, -300);
  await expect(price).not.toBeFocused();
  await expect(price).toHaveValue("123.45");
  await price.focus();
  await price.hover();
  await page.mouse.wheel(0, 300);
  await expect(price).not.toBeFocused();
  await expect(price).toHaveValue("123.45");
  await price.fill("150.75");
  await expect(price).toHaveValue("150.75");
  await page.goto("/course-access");
  const student = page.getByLabel("student id", { exact: true });
  await student.fill("41");
  await student.hover();
  await page.mouse.wheel(0, -300);
  await expect(student).not.toBeFocused();
  await expect(student).toHaveValue("41");
  await student.focus();
  await student.press("ArrowUp");
  await expect(student).toHaveValue("42");
});
