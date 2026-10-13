import { object, rows, str, type RecordData } from "../../shared/api/client";
export interface ChartSpec {
  title: string;
  kind: "line" | "bar";
  data: RecordData[];
  series: { key: string; name: string }[];
  unit?: string;
}
// Explicit endpoint adapters: never synthesize missing dates/metrics or combine unlike units.
export function analyticsCharts(
  data: RecordData,
  view: string,
  admin: boolean,
): ChartSpec[] {
  const charts: ChartSpec[] = [];
  const add = (
    title: string,
    source: unknown,
    x: string,
    metrics: [string, string][],
    kind: "line" | "bar" = "bar",
    unit?: string,
  ) => {
    charts.push({
      title,
      kind,
      unit,
      series: metrics.map(([key, name]) => ({ key, name })),
      data: rows(source).flatMap((row) => {
        if (row[x] == null || str(row[x]) === "") return [];
        const point: RecordData = { label: str(row[x]) };
        for (const [key] of metrics) {
          const value = row[key];
          if (
            (typeof value === "number" ||
              (typeof value === "string" && value.trim() !== "")) &&
            Number.isFinite(Number(value))
          )
            point[key] = Number(value);
        }
        return metrics.some(([key]) => point[key] !== undefined) ? [point] : [];
      }),
    });
  };
  const map = (title: string, source: unknown, unit?: string) =>
    add(
      title,
      Object.entries(object(source)).map(([label, value]) => ({
        label,
        value,
      })),
      "label",
      [["value", unit || "Count"]],
      "bar",
      unit,
    );
  const courses = (source: unknown) =>
    rows(source).map((r) => ({
      ...r,
      title: r.title || r.course_title || object(r.course).title,
      sales: object(r.revenue).amount,
    }));
  if (admin && view === "dashboard") {
    const trends = object(data.trends);
    add(
      "New users over time",
      trends.user_growth,
      "date",
      [
        ["students", "Students"],
        ["creators", "Creators"],
      ],
      "line",
    );
    add(
      "Gross course sales (SLE)",
      trends.revenue_trend,
      "date",
      [["revenue", "Gross sales (SLE)"]],
      "line",
      "SLE",
    );
    add(
      "Engagement over time",
      trends.engagement_trend,
      "date",
      [["average_engagement_score", "Average engagement score"]],
      "line",
    );
    add(
      "XP earned over time",
      trends.xp_trend,
      "date",
      [["xp_earned", "XP earned"]],
      "line",
      "XP",
    );
  } else if (admin && view === "users") {
    add(
      "New students and tutors",
      data.growth,
      "date",
      [
        ["students", "Students"],
        ["tutors", "Tutors"],
      ],
      "line",
    );
    const retention = object(data.retention);
    add(
      "Cohort retention",
      [
        { label: "Day 1", rate: retention.day_1_retention },
        { label: "Day 7", rate: retention.day_7_retention },
        { label: "Day 30", rate: retention.day_30_retention },
      ],
      "label",
      [["rate", "Retained (%)"]],
      "bar",
      "%",
    );
    map(
      "Users by university",
      object(data.demographics).geographic_distribution,
    );
    map("Gender distribution", object(data.demographics).gender_distribution);
  } else if (admin && view === "courses") {
    add("Course enrollments", data.popularity, "title", [
      ["enrollments", "Enrollments"],
    ]);
    add(
      "Course completion rates",
      courses(data.performance),
      "title",
      [["completion_rate", "Completed (%)"]],
      "bar",
      "%",
    );
    add(
      "Gross sales by course (SLE)",
      courses(data.performance),
      "title",
      [["sales", "Gross sales (SLE)"]],
      "bar",
      "SLE",
    );
  } else if (admin && view === "engagement") {
    const patterns = object(data.patterns);
    add("Activity by hour", patterns.hourly_patterns, "hour", [
      ["count", "Events"],
    ]);
    add("Activity by day", patterns.daily_patterns, "day", [
      ["count", "Events"],
    ]);
    add(
      "Activity by week",
      patterns.weekly_patterns,
      "week",
      [["count", "Events"]],
      "line",
    );
    map("Community interactions", data.social_engagement);
    map("Device usage", object(data.device_analytics).device_types);
  } else if (admin && view === "learning") {
    add(
      "Learning completion over time",
      object(data.progress_tracking).completion_trends,
      "date",
      [["completion_rate", "Completed (%)"]],
      "line",
      "%",
    );
    map(
      "Learning score distribution",
      object(data.performance_analysis).score_distribution,
    );
    add(
      "Learning progress over time",
      object(data.progress_tracking).learning_velocity,
      "date",
      [["average_progress", "Average progress (%)"]],
      "line",
      "%",
    );
  } else if (view === "system-health") {
    map("Errors by type", object(data.errors).error_types);
    add(
      "Alerts over time",
      Object.entries(object(object(data.alerts).alert_trends)).map(
        ([date, count]) => ({ date, count }),
      ),
      "date",
      [["count", "Alerts"]],
      "line",
    );
    const queue = object(data.queue);
    map(
      "Queue state snapshot",
      Object.fromEntries(
        ["pending", "delayed", "reserved", "failed"].map((key) => [
          key,
          queue[key],
        ]),
      ),
    );
  } else if (!admin && view === "dashboard") {
    add(
      "Course enrollments and completions",
      courses(data.course_performance),
      "title",
      [
        ["enrollments", "Enrollments"],
        ["completions", "Completions"],
      ],
    );
    add(
      "Gross sales by course (SLE)",
      courses(data.course_performance),
      "title",
      [["sales", "Gross sales (SLE)"]],
      "bar",
      "SLE",
    );
  } else if (!admin && view === "student-engagement") {
    add(
      "Student engagement",
      rows(data.engagement).map((r) => ({
        ...r,
        label: `${str(object(r.student).name)} · ${str(object(r.course).title)}`,
      })),
      "label",
      [["engagement_score", "Engagement score"]],
    );
  } else if (!admin && view === "effectiveness") {
    add(
      "Course completion rates",
      data.course_completion_rates,
      "course_title",
      [["completion_rate", "Completed (%)"]],
      "bar",
      "%",
    );
  } else if (!admin && view === "content-performance") {
    add(
      "Authored content by course",
      rows(data.content_performance).map((r) => {
        const modules = rows(r.modules);
        return {
          title: object(r.course).title,
          modules: modules.length,
          lessons: modules.reduce((sum, m) => sum + rows(m.lessons).length, 0),
          quizzes: modules.reduce((sum, m) => sum + rows(m.quizzes).length, 0),
        };
      }),
      "title",
      [
        ["modules", "Modules"],
        ["lessons", "Lessons"],
        ["quizzes", "Quizzes"],
      ],
    );
  }
  if (view === "course") {
    add(
      "Student progress",
      rows(object(data.analytics).student_analytics).map((r) => ({
        ...r,
        name: object(r.student).name,
      })),
      "name",
      [["progress", "Progress (%)"]],
      "bar",
      "%",
    );
  }
  return charts;
}
