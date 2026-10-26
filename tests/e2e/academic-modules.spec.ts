import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
type Data = Record<string, unknown>;
const facultyModule = {
  id: 9,
  code: "ENG 101",
  title: "Engineering Mathematics I",
  label: "ENG 101 — Engineering Mathematics I",
  scope: "faculty",
  is_active: true,
  university: { id: 1, name: "University" },
  faculty: { id: 3, name: "Engineering" },
  department: null,
  courses_count: 0,
};
const departmentModule = {
  ...facultyModule,
  id: 12,
  code: "EEE 101",
  title: "Circuit Theory I",
  label: "EEE 101 — Circuit Theory I",
  scope: "department",
  department: { id: 7, name: "Electrical" },
};
const retiredModule = {
  ...departmentModule,
  id: 21,
  is_active: false,
  courses_count: 2,
};
const meta = { current_page: 1, last_page: 1, per_page: 15, total: 0 };
async function fixture(page: Page, role = "admin") {
  const calls: { path: string; params: URLSearchParams; auth?: string }[] = [];
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
    const url = new URL(route.request().url()),
      path = url.pathname.replace("/api/v1/", "");
    calls.push({
      path,
      params: url.searchParams,
      auth: route.request().headers().authorization,
    });
    let data: unknown = [];
    if (path.endsWith("/check") || path.endsWith("/auth/profile"))
      data = { user };
    else if (path === "universities") data = [{ id: 1, name: "University" }];
    else if (path === "universities/1/faculties")
      data = [
        { id: 3, name: "Engineering" },
        { id: 4, name: "Arts" },
      ];
    else if (path === "universities/1/faculties/3/departments")
      data = [
        { id: 7, name: "Electrical" },
        { id: 8, name: "Civil" },
      ];
    else if (path === "academic-modules")
      data =
        url.searchParams.get("department_id") === "7"
          ? [facultyModule, departmentModule]
          : [facultyModule];
    else if (path === "admin/academic-modules")
      data = [facultyModule, departmentModule, retiredModule];
    else if (/admin\/academic-modules\/\d+$/.test(path))
      data = {
        academic_module: [facultyModule, departmentModule, retiredModule].find(
          (item) => String(item.id) === path.split("/").at(-1),
        ),
      };
    else if (path.endsWith("/modules")) data = { modules: [] };
    else if (path.endsWith("/resources")) data = { resources: [] };
    return route.fulfill({
      json: {
        success: true,
        data,
        meta: { ...meta, total: Array.isArray(data) ? data.length : 0 },
      },
    });
  });
  return calls;
}

test("course creation picks registered modules and context changes clear the assignment in the same save", async ({
  page,
}) => {
  const calls = await fixture(page, "tutor");
  let course: Data = {
    id: 1,
    uuid: "course-1",
    title: "Circuit basics",
    description: "Learn",
    status: "draft",
  };
  const writes: Data[] = [];
  await page.route("**/api/v1/tutor/courses", (route) => {
    const body = route.request().postDataJSON();
    writes.push(body);
    course = { ...course, ...body, academic_module: departmentModule };
    return route.fulfill({
      status: 201,
      json: { success: true, data: { course } },
    });
  });
  await page.route("**/api/v1/tutor/courses/course-1", (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      writes.push(body);
      course = {
        ...course,
        ...body,
        academic_module:
          body.academic_module_id == null ? null : departmentModule,
      };
    }
    return route.fulfill({ json: { success: true, data: { course } } });
  });
  await page.goto("/courses/new");
  await expect(page.getByLabel("Academic module", { exact: true })).toHaveValue(
    "",
  );
  expect(calls.filter((call) => call.path === "academic-modules")).toHaveLength(
    0,
  );
  await page.getByLabel("University", { exact: true }).selectOption("1");
  expect(calls.filter((call) => call.path === "academic-modules")).toHaveLength(
    0,
  );
  await page.getByLabel("Faculty", { exact: true }).selectOption("3");
  await expect(
    page
      .getByLabel("Academic module", { exact: true })
      .locator('optgroup[label="Faculty modules"] option'),
  ).toHaveCount(1);
  await page.getByLabel("Department", { exact: true }).selectOption("7");
  await page.getByLabel("Academic module", { exact: true }).selectOption("12");
  await page.getByLabel("Title *", { exact: true }).fill("Circuit basics");
  await page.getByLabel("Description *", { exact: true }).fill("Learn");
  await page
    .getByRole("button", { name: "Create course", exact: true })
    .click();
  await expect(page).toHaveURL(/courses\/course-1$/);
  expect(writes[0]).toMatchObject({
    university_id: 1,
    faculty_id: 3,
    department_id: 7,
    academic_module_id: 12,
  });
  expect(writes[0]).not.toHaveProperty("module_id");
  await expect(page.getByLabel("Academic module", { exact: true })).toHaveValue(
    "12",
  );
  await page.getByLabel("Faculty", { exact: true }).selectOption("4");
  await expect(page.getByLabel("Academic module", { exact: true })).toHaveValue(
    "",
  );
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1]).toMatchObject({
    faculty_id: 4,
    department_id: null,
    academic_module_id: null,
  });
  expect(
    calls
      .filter((call) => call.path === "academic-modules")
      .every((call) => call.auth === undefined),
  ).toBe(true);
});

test("retired course modules survive unrelated edits and can be cleared", async ({
  page,
}) => {
  await fixture(page, "educator");
  let course: Data = {
    id: 1,
    title: "Existing course",
    description: "Learn",
    status: "draft",
    university_id: 1,
    faculty_id: 3,
    department_id: 7,
    academic_module_id: 21,
    academic_module: retiredModule,
  };
  const writes: Data[] = [];
  await page.route("**/api/v1/tutor/courses/1", (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      writes.push(body);
      course = {
        ...course,
        ...body,
        academic_module:
          body.academic_module_id === null ? null : retiredModule,
      };
    }
    return route.fulfill({ json: { success: true, data: { course } } });
  });
  await page.goto("/courses/1");
  await expect(page.getByLabel("Academic module", { exact: true })).toHaveValue(
    "21",
  );
  await expect(
    page.getByText(
      "This module is retired. You can keep it on this course or choose an active replacement.",
    ),
  ).toBeVisible();
  await page
    .getByLabel("Title *", { exact: true })
    .fill("Changed course title");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].academic_module_id).toBe(21);
  await page.getByLabel("Academic module", { exact: true }).selectOption("");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].academic_module_id).toBeNull();
});

test("registry creates department modules, retains duplicate drafts and deactivates used modules with a partial update", async ({
  page,
}) => {
  await fixture(page);
  let record: Data = { ...departmentModule };
  const writes: Data[] = [];
  await page.route("**/api/v1/admin/academic-modules", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        json: { success: true, data: [record], meta: { ...meta, total: 1 } },
      });
    const body = route.request().postDataJSON();
    writes.push(body);
    if (writes.length === 1)
      return route.fulfill({
        status: 422,
        json: {
          success: false,
          error: {
            message: "Duplicate module code",
            details: {
              code: [
                "That code is already used by an inactive module. Reactivate it instead.",
              ],
            },
          },
        },
      });
    record = {
      ...departmentModule,
      ...body,
      label: `${body.code} — ${body.title}`,
      courses_count: 2,
    };
    return route.fulfill({
      status: 201,
      json: { success: true, data: { academic_module: record } },
    });
  });
  await page.route("**/api/v1/admin/academic-modules/12", (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      writes.push(body);
      record = { ...record, ...body };
    }
    return route.fulfill({
      json: { success: true, data: { academic_module: record } },
    });
  });
  await page.goto("/academic-modules/new");
  await page.getByLabel("Scope *", { exact: true }).selectOption("department");
  await page.getByLabel("University *", { exact: true }).selectOption("1");
  await page.getByLabel("Faculty *", { exact: true }).selectOption("3");
  await page.getByLabel("Department", { exact: true }).selectOption("7");
  await page.getByLabel("Code *", { exact: true }).fill("csc-101");
  await page.getByLabel("Title *", { exact: true }).fill("Circuit Theory I");
  await page
    .getByRole("button", { name: "Create academic module", exact: true })
    .click();
  await expect(
    page.getByText("Duplicate module code", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Code *", { exact: true })).toHaveValue(
    "csc-101",
  );
  await page.getByLabel("Code *", { exact: true }).fill("EEE 101");
  await page
    .getByRole("button", { name: "Create academic module", exact: true })
    .click();
  await expect(page).toHaveURL(/academic-modules\/12$/);
  expect(writes[1]).toMatchObject({
    scope: "department",
    university_id: 1,
    faculty_id: 3,
    department_id: 7,
    code: "EEE 101",
    is_active: true,
  });
  await expect(page.getByLabel("Scope *", { exact: true })).toHaveCount(0);
  await expect(page.getByText("2 courses use this module.")).toBeVisible();
  await page.getByLabel("Active", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect.poll(() => writes.length).toBe(3);
  expect(writes[2]).toEqual({ is_active: false });
});

test("used registry modules cannot be deleted and list filters keep inactive values across pages", async ({
  page,
}, testInfo) => {
  await fixture(page);
  const queries: URLSearchParams[] = [];
  await page.route("**/api/v1/admin/academic-modules?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    queries.push(params);
    return route.fulfill({
      json: {
        success: true,
        data: [retiredModule],
        meta: {
          ...meta,
          current_page: Number(params.get("page") || 1),
          last_page: 2,
          total: 16,
        },
      },
    });
  });
  await page.route("**/api/v1/admin/academic-modules/21", (route) =>
    route.request().method() === "DELETE"
      ? route.fulfill({
          status: 409,
          json: {
            success: false,
            error: {
              code: "ACADEMIC_MODULE_IN_USE",
              message:
                "This module is used by 2 courses. Deactivate it instead.",
              details: { courses_count: 2 },
            },
          },
        })
      : route.fulfill({
          json: { success: true, data: { academic_module: retiredModule } },
        }),
  );
  await page.goto("/academic-modules");
  await page.getByLabel("Module active filter").selectOption("0");
  await page.getByLabel("Module scope filter").selectOption("department");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect.poll(() => queries.at(-1)?.get("page")).toBe("2");
  expect(queries.at(-1)?.get("is_active")).toBe("0");
  expect(queries.at(-1)?.get("scope")).toBe("department");
  await page.screenshot({
    path: testInfo.outputPath("academic-registry-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("link", { name: retiredModule.label, exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm deletion", exact: true })
    .click();
  await expect(
    page.getByText("This module is used by 2 courses. Deactivate it instead.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("course module filters use registry IDs, preserve pagination, and are available in the roadmap picker", async ({
  page,
}) => {
  await fixture(page);
  const queries: URLSearchParams[] = [];
  await page.route("**/api/v1/admin/courses?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    queries.push(params);
    return route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: 1,
            title: "Circuit basics",
            status: "published",
            academic_module: departmentModule,
          },
        ],
        meta: {
          ...meta,
          current_page: Number(params.get("page") || 1),
          last_page: 2,
          total: 16,
        },
      },
    });
  });
  await page.goto("/courses");
  await page
    .getByLabel("Academic module filter", { exact: true })
    .selectOption("12");
  await expect.poll(() => queries.at(-1)?.get("academic_module_id")).toBe("12");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect.poll(() => queries.at(-1)?.get("page")).toBe("2");
  expect(queries.at(-1)?.get("academic_module_id")).toBe("12");
  await expect(
    page.getByText(departmentModule.label, { exact: true }).last(),
  ).toBeVisible();
  await page.goto("/roadmaps/new");
  await page
    .getByLabel("Course academic module filter", { exact: true })
    .selectOption("12");
  await page
    .getByRole("button", { name: "Fetch courses", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Select Circuit basics" }),
  ).toBeVisible();
  expect(queries.at(-1)?.get("academic_module_id")).toBe("12");
});

test("registry URLs are admin-only and course selectors fit mobile without exposing free-text module IDs", async ({
  page,
}, testInfo) => {
  await fixture(page, "tutor");
  await page.goto("/academic-modules/new");
  await expect(
    page.getByRole("heading", { name: "Access restricted" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Academic modules", exact: true }),
  ).toHaveCount(0);
  await page.goto("/courses/new");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("University", { exact: true }).selectOption("1");
  await page.getByLabel("Faculty", { exact: true }).selectOption("3");
  await page.getByLabel("Department", { exact: true }).selectOption("7");
  await page.getByLabel("Academic module", { exact: true }).selectOption("12");
  expect(
    await page
      .getByLabel("Academic module", { exact: true })
      .evaluate((element) => element.tagName),
  ).toBe("SELECT");
  await page.screenshot({
    path: testInfo.outputPath("academic-course-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const result = await new AxeBuilder({ page })
    .include(".editor-form")
    .analyze();
  expect(
    result.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact || ""),
    ),
  ).toEqual([]);
});

test("module lookup pagination and search retain selections and lookup failures preserve the course draft", async ({
  page,
}) => {
  await fixture(page, "tutor");
  const queries: URLSearchParams[] = [];
  await page.route("**/api/v1/academic-modules?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    queries.push(params);
    if (params.get("search") === "fail")
      return route.fulfill({
        status: 500,
        json: {
          success: false,
          error: { message: "Module lookup unavailable" },
        },
      });
    const second = params.get("page") === "2";
    return route.fulfill({
      json: {
        success: true,
        data:
          second || params.get("search") ? [departmentModule] : [facultyModule],
        meta: {
          ...meta,
          total: 16,
          last_page: 2,
          current_page: second ? 2 : 1,
        },
      },
    });
  });
  await page.goto("/courses/new");
  await page
    .getByLabel("Title *", { exact: true })
    .fill("Keep this course draft");
  await page.getByLabel("University", { exact: true }).selectOption("1");
  await page.getByLabel("Faculty", { exact: true }).selectOption("3");
  await page.getByLabel("Department", { exact: true }).selectOption("7");
  await page.getByLabel("Academic module", { exact: true }).selectOption("9");
  await page.getByRole("button", { name: "Next modules", exact: true }).click();
  await expect.poll(() => queries.at(-1)?.get("page")).toBe("2");
  await expect(page.getByLabel("Academic module", { exact: true })).toHaveValue(
    "9",
  );
  await page.getByLabel("Academic module", { exact: true }).selectOption("12");
  await page
    .getByLabel("Find academic module", { exact: true })
    .fill("EEE-101");
  await page.getByRole("button", { name: "Find modules", exact: true }).click();
  await expect.poll(() => queries.at(-1)?.get("search")).toBe("EEE-101");
  expect(queries.at(-1)?.get("department_id")).toBe("7");
  expect(queries.at(-1)?.get("page")).toBe("1");
  await page.getByLabel("Find academic module", { exact: true }).fill("fail");
  await page.getByRole("button", { name: "Find modules", exact: true }).click();
  await expect(
    page.getByText("Module lookup unavailable", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Title *", { exact: true })).toHaveValue(
    "Keep this course draft",
  );
  await expect(page.getByLabel("Academic module", { exact: true })).toHaveValue(
    "12",
  );
});

test("a registry move conflict retains the selected academic context", async ({
  page,
}) => {
  await fixture(page);
  await page.route("**/api/v1/admin/academic-modules/9", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({
          status: 409,
          json: {
            success: false,
            error: {
              code: "ACADEMIC_MODULE_IN_USE",
              message:
                "This academic module is now used by a course and cannot be moved.",
            },
          },
        })
      : route.fulfill({
          json: { success: true, data: { academic_module: facultyModule } },
        }),
  );
  await page.goto("/academic-modules/9");
  await page.getByLabel("Faculty *", { exact: true }).selectOption("4");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText(
      "This academic module is now used by a course and cannot be moved.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Faculty *", { exact: true })).toHaveValue("4");
});

test("faculty dependency errors are surfaced when academic modules prevent deletion", async ({
  page,
}) => {
  await fixture(page);
  await page.route("**/api/v1/admin/faculties/3", (route) =>
    route.request().method() === "DELETE"
      ? route.fulfill({
          status: 422,
          json: {
            success: false,
            error: {
              code: "FACULTY_HAS_ACADEMIC_MODULES",
              message:
                "This faculty owns academic modules and cannot be deleted.",
            },
          },
        })
      : route.fulfill({
          json: {
            success: true,
            data: {
              faculty: {
                id: 3,
                university_id: 1,
                name: "Engineering",
                is_active: true,
              },
            },
          },
        }),
  );
  await page.goto("/faculties/3");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm deletion", exact: true })
    .click();
  await expect(
    page.getByText(
      "This faculty owns academic modules and cannot be deleted.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page).toHaveURL(/faculties\/3$/);
});
