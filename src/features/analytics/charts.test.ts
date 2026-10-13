import { expect, it } from "vitest";
import { analyticsCharts } from "./charts";
it("keeps missing observations unavailable and preserves genuine zeros", () => {
  const charts = analyticsCharts(
    {
      trends: {
        revenue_trend: [
          { date: "2026-10-01", revenue: 0 },
          { date: "2026-10-02", revenue: null },
          { date: "2026-10-03", revenue: "12.50" },
        ],
      },
    },
    "dashboard",
    true,
  );
  const sales = charts.find((c) => c.unit === "SLE")!;
  expect(sales.data).toEqual([
    { label: "2026-10-01", revenue: 0 },
    { label: "2026-10-03", revenue: 12.5 },
  ]);
  expect(sales.series[0].name).toContain("Gross sales");
});
it("uses documented distributions and keeps percentage and money series separate", () => {
  const users = analyticsCharts(
    { demographics: { geographic_distribution: { Njala: 12 } } },
    "users",
    true,
  );
  expect(users.find((c) => c.title === "Users by university")?.data).toEqual([
    { label: "Njala", value: 12 },
  ]);
  const courses = analyticsCharts(
    {
      performance: [
        { title: "Course", completion_rate: 75, revenue: { amount: 90 } },
      ],
    },
    "courses",
    true,
  );
  expect(courses.find((c) => c.unit === "%")?.series).toEqual([
    { key: "completion_rate", name: "Completed (%)" },
  ]);
  expect(courses.find((c) => c.unit === "SLE")?.data[0].sales).toBe(90);
});
it("does not chart known placeholder lesson analytics", () => {
  const charts = analyticsCharts(
    {
      content_performance: [
        {
          course: { title: "Course" },
          modules: [
            { lessons: [{ analytics: { completion_rate: 99 } }], quizzes: [] },
          ],
        },
      ],
    },
    "content-performance",
    false,
  );
  expect(charts[0].data).toEqual([
    { label: "Course", modules: 1, lessons: 1, quizzes: 0 },
  ]);
  expect(charts[0].series.map((s) => s.key)).not.toContain("completion_rate");
});
