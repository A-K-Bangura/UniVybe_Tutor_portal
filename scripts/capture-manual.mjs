// Read-only student build preview. All API responses are illustrative fixtures.
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  chromium,
} = require("C:/Users/akbJ/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const root = resolve(process.argv[2] || "../../Edu_Student_g1/dist");
const output = resolve("docs/course-creation/screenshots");
await mkdir(output, { recursive: true });
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  let file = resolve(
    root,
    "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
  );
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const bytes = await readFile(file);
    res.setHeader(
      "Content-Type",
      mime[extname(file)] || "application/octet-stream",
    );
    res.end(bytes);
  } catch {
    res.setHeader("Content-Type", "text/html");
    res.end(await readFile(resolve(root, "index.html")));
  }
});
await new Promise((r) => server.listen(5188, "127.0.0.1", r));
let browser;
try {
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const user = {
    id: 999,
    firstname: "Demo",
    lastname: "Educator",
    full_name: "Demo Educator",
    level: "graduate",
    email: "demo@example.test",
    role: "student",
    status: "active",
  };
  await page.addInitScript((user) => {
    localStorage.setItem("auth_token", "manual-fixture-only");
    localStorage.setItem("user", JSON.stringify(user));
  }, user);
  const blocks = [
    {
      content_type: "text",
      text_type: "plain",
      content:
        "A course contains modules. Each module contains lessons. Use mini-lessons to divide a lesson into focused learning screens, then add content blocks inside each mini-lesson.",
    },
    {
      content_type: "text",
      text_type: "simply_put",
      content:
        "Course → Module → Lesson → Mini-lesson → Content blocks. Quizzes belong to the lesson.",
    },
    {
      content_type: "text",
      text_type: "remember",
      content: "Save each editor before moving to another item in the outline.",
    },
  ].map((b, i) => ({
    ...b,
    id: 400 + i,
    mini_lesson_id: 30,
    order_index: i,
    is_published: true,
  }));
  const quiz = {
    id: 50,
    quiz_type: "multiple_choice",
    question: "Where do you add a quiz?",
    options: ["To a lesson", "Inside an image", "To the course thumbnail"],
    correct_answer: ["0"],
    explanation: "Quizzes belong to a lesson, alongside its mini-lessons.",
    order_index: 0,
    lesson_id: 20,
    attempts_allowed: 3,
    xp_reward: 0,
  };
  const lesson = {
    id: 20,
    title: "Understand the course structure",
    description: "Learn how the pieces fit together.",
    module_id: 10,
    lesson_type: "reading",
    order_index: 0,
    mini_lessons: [
      {
        id: 30,
        title: "Build a clear learning path",
        lesson_id: 20,
        order_index: 0,
        blocks,
      },
    ],
    quizzes: [quiz],
  };
  const course = {
    id: 1,
    uuid: "manual-demo",
    title: "Create your first UniVybe course",
    short_description: "A practical guide for educators and tutors",
    description:
      "Plan a focused course, build its lessons, choose suitable content blocks, write quizzes and check the student experience before submitting for approval.",
    level: "general",
    is_paid: false,
    price: null,
    coin_reward: 0,
    is_enrolled: true,
    enrollment_state: "enrolled",
    status: "published",
    creator: {
      id: 999,
      name: "UniVybe educator training",
      title: "Educator development",
    },
    meta: {
      modules_count: 1,
      lessons_count: 1,
      estimated_hours: 1,
      published_at: "2026-10-26",
    },
    modules: [
      {
        id: 10,
        title: "Plan and structure your course",
        description: "Start with a clear outcome.",
        order_index: 0,
        lessons: [lesson],
      },
    ],
    roadmaps: [],
  };
  const progress = {
    course_id: 1,
    progress_percentage: 0,
    lessons_completed: 0,
    quizzes_completed: 0,
    completed_lessons: [],
    completed_quizzes: [],
    total_lessons: 1,
    total_quizzes: 1,
    is_completed: false,
  };
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes("/api/")) {
      const path = url.pathname;
      let data = path.endsWith("/progress")
        ? { progress }
        : path.includes("/lessons/20")
          ? { lesson }
          : /\/courses\/(1|manual-demo)$/.test(path)
            ? { course, is_enrolled: true }
            : path.endsWith("/profile")
              ? { student: user, user }
              : path.endsWith("/check")
                ? { authenticated: true, user }
                : path.includes("/resources")
                  ? { data: [], current_page: 1, last_page: 1, total: 0 }
                  : { data: [], user };
      return route.fulfill({ json: { success: true, data } });
    }
    if (url.origin !== "http://127.0.0.1:5188") return route.abort();
    return route.continue();
  });
  await page.goto("http://127.0.0.1:5188/course/1");
  await page
    .getByRole("heading", { name: course.title, exact: true })
    .waitFor();
  await page.screenshot({
    path: resolve(output, "01-student-course.png"),
    fullPage: true,
  });
  await page.goto("http://127.0.0.1:5188/course/1/module/10/lesson/20");
  await page.getByText(blocks[0].content, { exact: true }).waitFor();
  await page.screenshot({
    path: resolve(output, "02-student-lesson.png"),
    fullPage: true,
  });
  console.log((await page.getByRole("button").allTextContents()).join(" | "));
  await page.getByRole("button", { name: /next/i }).last().click();
  await page.getByText(quiz.question, { exact: true }).waitFor();
  await page.screenshot({
    path: resolve(output, "03-student-quiz.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: resolve(output, "04-student-mobile-quiz.png"),
    fullPage: true,
    animations: "disabled",
  });
  console.log(
    "Captured four screenshots from the existing student build with illustrative API fixtures.",
  );
  await context.close();
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
