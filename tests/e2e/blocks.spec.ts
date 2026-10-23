import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

type RecordData = Record<string, unknown>;
async function builder(
  page: Page,
  block?: RecordData,
  extra: RecordData[] = [],
) {
  let records = block ? [block, ...extra] : extra;
  await page.addInitScript(() => {
    sessionStorage.setItem("univybe.token", "fixture-token");
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          (window as unknown as { copied: string }).copied = text;
        },
      },
      configurable: true,
    });
  });
  const user = {
    id: "creator",
    email: "creator@example.test",
    firstname: "Amina",
    lastname: "Tutor",
    phone: "+23276123456",
    qualification: "Degree",
    status: "approved",
    role: { name: "tutor" },
  };
  const tree: Record<string, unknown> = {
    "courses/1": {
      course: {
        id: 1,
        title: "AI study skills",
        description: "Learn with tools",
        status: "draft",
      },
    },
    "courses/1/modules": { modules: [{ id: 10, title: "Module" }] },
    "modules/10/lessons": { lessons: [{ id: 20, title: "Lesson" }] },
    "lessons/20/mini-lessons": {
      mini_lessons: [{ id: 30, title: "Mini lesson" }],
    },
    "courses/1/resources": { resources: [] },
    "lessons/20/quizzes": { quizzes: [] },
  };
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(
      "/api/v1/",
      "",
    );
    const data =
      path.endsWith("auth/profile") || path.endsWith("/check")
        ? { user }
        : path === "tutor/mini-lessons/30/blocks"
          ? { blocks: records }
          : path.startsWith("tutor/")
            ? tree[path.slice(6)] || []
            : [];
    return route.fulfill({
      json: {
        success: true,
        data,
        meta: { total: 0, current_page: 1, last_page: 1 },
      },
    });
  });
  const writes: RecordData[] = [];
  await page.route("**/api/v1/tutor/content/mini-lesson-blocks**", (route) => {
    const body = route.request().postDataJSON();
    writes.push(body);
    const saved = { ...records[0], ...body, id: 40 };
    records = [saved];
    return route.fulfill({
      status: route.request().method() === "POST" ? 201 : 200,
      json: { success: true, data: { block: saved } },
    });
  });
  await page.goto("/courses/1");
  for (const name of ["Module", "Lesson", "Mini lesson"])
    await page
      .getByRole("button", { name: `Expand ${name}`, exact: true })
      .click();
  if (block)
    await page
      .getByRole("button", {
        name: block.title
          ? String(block.title)
          : block.text_type === "prompt"
            ? "Prompt block"
            : block.text_type === "link"
              ? "Link block"
              : "text block",
        exact: true,
      })
      .click();
  else
    await page
      .locator(".outline-group-head")
      .filter({
        has: page.locator("strong", { hasText: /^mini lesson blocks$/ }),
      })
      .getByRole("button", { name: "Add", exact: true })
      .click();
  return { writes, records: () => records };
}

test("link blocks validate before saving, preview destinations and preserve or clear labels", async ({
  page,
}) => {
  const { writes } = await builder(page);
  await page.getByLabel("Text type", { exact: true }).selectOption("link");
  await page
    .getByLabel("Link URL", { exact: true })
    .fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText(/Enter one http:\/\/ or https:\/\/ URL/),
  ).toBeVisible();
  expect(writes).toHaveLength(0);
  await expect(
    page.getByRole("button", { name: "Check link", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Link URL", { exact: true })
    .fill("https://chatgpt.com/");
  await page.getByLabel("Link label", { exact: true }).fill("Open ChatGPT");
  const preview = page.getByRole("region", { name: "Block preview" });
  await expect(
    preview.getByRole("link", { name: "Open ChatGPT", exact: true }),
  ).toHaveAttribute("href", "https://chatgpt.com/");
  await expect(preview.getByRole("link")).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
  await expect(
    preview.getByText("Opens chatgpt.com in a new tab"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Check link", exact: true }),
  ).toHaveAttribute("target", "_blank");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({
    mini_lesson_id: 30,
    content_type: "text",
    text_type: "link",
    content: "https://chatgpt.com/",
    media_metadata: { label: "Open ChatGPT" },
  });
  await expect(
    page.getByRole("button", { name: "Link block", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Link URL", { exact: true })
    .fill("https://example.org/new");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1]).not.toHaveProperty("media_metadata");
  await page.getByLabel("Link label", { exact: true }).fill("");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect.poll(() => writes.length).toBe(3);
  expect(writes[2].media_metadata).toBeNull();
});

test("long prompts remain literal, copy exactly, save and reopen with whitespace intact", async ({
  page,
}, testInfo) => {
  const prompt =
    'You are a tutor for {{grade}}.\n\n  <task>Explain [fractions] 📚</task>\n<script>window.promptExecuted = true</script>\n```js\n  const path = "C:\\notes";\n```\nhttps://example.org/tools\n' +
    "Keep my words and indentation. ".repeat(1100);
  const { writes } = await builder(page);
  await page.getByLabel("Text type", { exact: true }).selectOption("prompt");
  await page.getByLabel("Prompt text", { exact: true }).fill(prompt);
  const preview = page.getByRole("region", { name: "Block preview" });
  expect(await preview.locator("pre").textContent()).toBe(prompt);
  await expect(preview.locator("script,iframe,.link-preview,a")).toHaveCount(0);
  await expect(page.getByLabel("Link label", { exact: true })).toHaveCount(0);
  await preview
    .getByRole("button", { name: "Copy prompt", exact: true })
    .click();
  expect(
    await page.evaluate(() => (window as unknown as { copied: string }).copied),
  ).toBe(prompt);
  await expect(
    preview.getByText("Prompt copied", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].content).toBe(prompt);
  await page.reload();
  for (const name of ["Module", "Lesson", "Mini lesson"])
    await page
      .getByRole("button", { name: `Expand ${name}`, exact: true })
      .click();
  await page.getByRole("button", { name: "Prompt block", exact: true }).click();
  await expect(page.getByLabel("Prompt text", { exact: true })).toHaveValue(
    prompt,
  );
  await page
    .getByLabel("Prompt text", { exact: true })
    .fill(
      "You are a patient tutor for {{grade}}.\n\n  <task>Explain fractions with a local example.</task>\n\nKeep the indentation and [placeholders].",
    );
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator(".block-form")
    .screenshot({ path: testInfo.outputPath("prompt-editor-mobile.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const result = await new AxeBuilder({ page })
    .include(".block-form")
    .analyze();
  expect(
    result.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact || ""),
    ),
  ).toEqual([]);
});

test("formula and prompt cannot be emptied, and converting to media omits the text subtype", async ({
  page,
}) => {
  const { writes } = await builder(page, {
    id: 40,
    content_type: "text",
    text_type: "formula",
    content: "x^2",
    media_metadata: null,
  });
  await page.getByLabel("Content", { exact: true }).fill("   ");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText(
      "Formula blocks need non-empty LaTeX. Delete the block to remove a formula.",
    ),
  ).toBeVisible();
  expect(writes).toHaveLength(0);
  await page.getByLabel("Text type", { exact: true }).selectOption("prompt");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("Text blocks need non-empty content."),
  ).toBeVisible();
  await page
    .getByLabel("Content type *", { exact: true })
    .selectOption("image");
  await page
    .getByLabel("Media url", { exact: true })
    .fill("https://example.org/image.png");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({
    content_type: "image",
    media_url: "https://example.org/image.png",
  });
  expect(writes[0]).not.toHaveProperty("text_type");
});

test("nested label errors retain draft and dirty navigation; unknown save outcomes block repeats", async ({
  page,
}) => {
  await builder(page, {
    id: 40,
    content_type: "text",
    text_type: "link",
    content: "https://chatgpt.com/",
    media_metadata: { label: "Open ChatGPT" },
  });
  let writes = 0;
  await page.route("**/api/v1/tutor/content/mini-lesson-blocks/40", (route) => {
    writes++;
    return route.fulfill({
      status: writes === 1 ? 422 : 500,
      json: {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: writes === 1 ? "Label rejected" : "Save unavailable",
          details:
            writes === 1
              ? { "media_metadata.label": ["Use a clearer label"] }
              : {},
        },
      },
    });
  });
  await page.getByLabel("Link label", { exact: true }).fill("Keep this label");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("Use a clearer label", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Link label", { exact: true })).toHaveValue(
    "Keep this label",
  );
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "You have unsaved changes" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stay", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeDisabled();
  expect(writes).toBe(2);
  await page
    .getByRole("button", { name: "Check saved blocks", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Load saved block", exact: true })
    .click();
  await expect(page.getByLabel("Link label", { exact: true })).toHaveValue(
    "Open ChatGPT",
  );
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeEnabled();
});

test("complete course preview renders stored links and prompts with safe interactions", async ({
  page,
}) => {
  await builder(
    page,
    {
      id: 40,
      content_type: "text",
      text_type: "prompt",
      content: "Summarize {{topic}}.\n  Keep <tags>.",
    },
    [
      {
        id: 41,
        content_type: "text",
        text_type: "link",
        content: "https://chatgpt.com/",
        media_metadata: { label: "Open ChatGPT" },
      },
    ],
  );
  await page
    .getByRole("button", { name: "Preview course", exact: true })
    .click();
  const preview = page.getByRole("dialog", { name: "Creator course preview" });
  await expect(
    preview.getByRole("link", { name: "Open ChatGPT", exact: true }),
  ).toHaveAttribute("href", "https://chatgpt.com/");
  await expect(
    preview.getByLabel("Prompt content", { exact: true }),
  ).toHaveText("Summarize {{topic}}.\n  Keep <tags>.");
  await preview
    .getByRole("button", { name: "Copy prompt", exact: true })
    .click();
  expect(
    await page.evaluate(() => (window as unknown as { copied: string }).copied),
  ).toBe("Summarize {{topic}}.\n  Keep <tags>.");
});
