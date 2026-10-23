import { test, expect, type Page } from "@playwright/test";

async function fixture(page: Page, role = "admin") {
  await page.addInitScript(() =>
    sessionStorage.setItem("univybe.token", "fixture-token"),
  );
  const user = {
    id: "creator",
    email: "creator@example.test",
    firstname: "Amina",
    lastname: "Creator",
    phone: "+23276123456",
    qualification: "Degree",
    status: "approved",
    role: { name: role },
  };
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const data =
      path.endsWith("/auth/profile") || path.endsWith("/check")
        ? { user }
        : path.endsWith("/modules")
          ? { modules: [] }
          : path.endsWith("/resources")
            ? { resources: [] }
            : path.endsWith("/types")
              ? { resource_types: [{ value: "article", label: "Article" }] }
              : [];
    return route.fulfill({
      json: {
        success: true,
        data,
        meta: { total: 0, current_page: 1, last_page: 1 },
      },
    });
  });
}

for (const kind of ["courses", "roadmaps"] as const) {
  test(`${kind} general level creates, reloads, edits and clears to null`, async ({
    page,
  }) => {
    await fixture(page, kind === "courses" ? "tutor" : "admin");
    const prefix = kind === "courses" ? "tutor" : "admin";
    const singular = kind === "courses" ? "course" : "roadmap";
    let record: Record<string, unknown> = {
      id: 1,
      uuid: "content-1",
      title: "Study skills",
      description: "For a wider audience",
      status: "draft",
      courses: [],
    };
    const writes: Record<string, unknown>[] = [];
    await page.route(`**/api/v1/${prefix}/${kind}`, (route) => {
      const body = route.request().postDataJSON();
      writes.push(body);
      record = { ...record, ...body };
      return route.fulfill({
        status: 201,
        json: { success: true, data: { [singular]: record } },
      });
    });
    await page.route(`**/api/v1/${prefix}/${kind}/content-1`, (route) => {
      if (route.request().method() === "PUT") {
        const body = route.request().postDataJSON();
        writes.push(body);
        record = { ...record, ...body };
      }
      return route.fulfill({
        json: { success: true, data: { [singular]: record } },
      });
    });
    // The course builder saves with the record's numeric ID.
    await page.route(`**/api/v1/${prefix}/${kind}/1`, (route) => {
      if (route.request().method() === "PUT") {
        const body = route.request().postDataJSON();
        writes.push(body);
        record = { ...record, ...body };
      }
      return route.fulfill({
        json: { success: true, data: { [singular]: record } },
      });
    });
    await page.goto(`/${kind}/new`);
    await page.getByLabel("Title *", { exact: true }).fill("Study skills");
    if (kind === "courses")
      await page
        .getByLabel("Description *", { exact: true })
        .fill("For a wider audience");
    else
      await page.getByLabel("Status *", { exact: true }).selectOption("draft");
    await page.getByLabel("Level", { exact: true }).selectOption("general");
    await page
      .getByRole("button", { name: `Create ${singular}`, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${kind}/content-1$`));
    expect(writes[0].level).toBe("general");
    await expect(page.getByLabel("Level", { exact: true })).toHaveValue(
      "general",
    );
    await page.reload();
    await expect(page.getByLabel("Level", { exact: true })).toHaveValue(
      "general",
    );
    await page.getByLabel("Level", { exact: true }).selectOption("200");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect.poll(() => writes.at(-1)?.level).toBe("200");
    await page.getByLabel("Level", { exact: true }).selectOption("general");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect.poll(() => writes.at(-1)?.level).toBe("general");
    await page.getByLabel("Level", { exact: true }).selectOption("");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect.poll(() => writes.at(-1)?.level).toBeNull();
    await page.reload();
    await expect(page.getByLabel("Level", { exact: true })).toHaveValue("");
    await expect(
      page.getByLabel("Level", { exact: true }).locator("option:checked"),
    ).toHaveText("Not set");
  });

  test(`admin ${kind} filter sends exact general and year values through pagination`, async ({
    page,
  }) => {
    await fixture(page);
    const queries: URLSearchParams[] = [];
    await page.route(`**/api/v1/admin/${kind}?**`, (route) => {
      const params = new URL(route.request().url()).searchParams;
      queries.push(params);
      return route.fulfill({
        json: {
          success: true,
          data: [
            {
              id: 1,
              title: "General study skills",
              level: params.get("level"),
              status: "draft",
            },
          ],
          meta: {
            total: 16,
            current_page: Number(params.get("page") || 1),
            last_page: 2,
          },
        },
      });
    });
    await page.goto(`/${kind}`);
    await page
      .getByLabel("Filter by level", { exact: true })
      .selectOption("general");
    await expect.poll(() => queries.at(-1)?.get("level")).toBe("general");
    await expect(
      page.getByText("General — wider audience", { exact: true }).last(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect.poll(() => queries.at(-1)?.get("page")).toBe("2");
    expect(queries.at(-1)?.get("level")).toBe("general");
    await page
      .getByLabel("Filter by level", { exact: true })
      .selectOption("200");
    await expect.poll(() => queries.at(-1)?.get("level")).toBe("200");
    expect(queries.at(-1)?.has("page")).toBe(false);
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    await expect(
      page.getByLabel("Filter by level", { exact: true }),
    ).toHaveValue("");
    expect(new URL(page.url()).searchParams.has("level")).toBe(false);
  });
}

test("roadmap course picker offers general while resources and tutor lists keep their contracts", async ({
  page,
}) => {
  await fixture(page);
  let query: URLSearchParams | undefined;
  await page.route("**/api/v1/admin/courses?**", (route) => {
    query = new URL(route.request().url()).searchParams;
    return route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: 7,
            title: "Open study skills",
            status: "published",
            level: "general",
          },
        ],
        meta: { total: 1, current_page: 1, last_page: 1 },
      },
    });
  });
  await page.goto("/roadmaps/new");
  await page.getByLabel("Course level filter").selectOption("general");
  await page
    .getByRole("button", { name: "Fetch courses", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Select Open study skills" }),
  ).toBeVisible();
  expect(query?.get("level")).toBe("general");
  await page.goto("/resources/new");
  await expect(
    page
      .getByLabel("Level", { exact: true })
      .locator('option[value="general"]'),
  ).toHaveCount(0);
  await page.unroute("**/api/v1/**");
  await fixture(page, "tutor");
  await page.goto("/courses");
  await expect(
    page.getByRole("heading", { name: "Courses", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Filter by level", { exact: true })).toHaveCount(
    0,
  );
});
