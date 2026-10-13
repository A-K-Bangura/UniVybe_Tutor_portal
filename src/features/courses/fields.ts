import type { Field } from "../../shared/forms/SchemaForm";
export const f = (
  name: string,
  type: Field["type"] = "text",
  required = false,
  options?: string[],
): Field => ({ name, type, required, options });
export const academic = [
  f("university_id", "number"),
  f("faculty_id", "number"),
  f("department_id", "number"),
  f("organization_id", "number"),
  f("level", "select", false, [
    "UnderGrad",
    "100",
    "200",
    "300",
    "400",
    "500",
    "graduate",
  ]),
  f("semester"),
];
export const courseFields: Field[] = [
  f("title", "text", true),
  f("short_description", "textarea"),
  f("description", "textarea", true),
  ...academic.filter((x) => x.name !== "organization_id"),
  f("course_code"),
  f("estimated_duration_hours", "number"),
  f("estimated_lessons_count", "number"),
  f("estimated_quizzes_count", "number"),
  f("learning_objectives", "array"),
  f("prerequisites", "array"),
  f("tags", "array"),
  f("thumbnail_url", "url"),
  { ...f("suggested_is_paid", "boolean"), label: "Suggest a paid course" },
  { ...f("suggested_price", "number"), label: "Suggested price (SLE)" },
  {
    ...f("suggested_coin_reward", "number"),
    label: "Suggested Vybe Coin reward",
    help: "Suggestions only. An admin sets final pricing and rewards.",
  },
];
export const contentFields: Record<string, Field[]> = {
  modules: [
    f("title", "text", true),
    f("description", "textarea"),
    f("learning_objectives", "array"),
    f("estimated_duration_minutes", "number"),
    f("is_published", "boolean"),
  ],
  lessons: [
    f("title", "text", true),
    f("description", "textarea"),
    f("lesson_type", "select", true, ["reading", "video", "mixed"]),
    f("estimated_duration_minutes", "number"),
    f("learning_objectives", "array"),
    f("prerequisites", "array"),
    f("xp_reward", "number"),
  ],
  "mini-lessons": [
    f("title", "text", true),
    f("description", "textarea"),
    f("is_published", "boolean"),
  ],
  "mini-lesson-blocks": [
    f("content_type", "select", true, [
      "text",
      "image",
      "video",
      "embed",
      "document",
    ]),
    f("text_type", "select", false, [
      "plain",
      "simply_put",
      "important",
      "remember",
      "formula",
    ]),
    f("content", "textarea"),
    {
      ...f("media_url", "url"),
      help: "Paste a media URL, including YouTube watch, share or embed URLs. Paste the URL rather than iframe code.",
    },
    f("media_metadata", "json"),
    f("is_published", "boolean"),
  ],
  quizzes: [
    f("quiz_type", "select", true, [
      "mcq",
      "short_answer",
      "one_word",
      "fill_blank",
      "tap_fill",
    ]),
    f("question", "textarea", true),
    { ...f("options", "array"), help: "One option per line." },
    {
      ...f("correct_answer", "array", true),
      help: "One answer per line. Blank and tap-fill answers are stored in blank order.",
    },
    f("explanation", "textarea"),
    f("image_url", "url"),
    f("time_limit_seconds", "number"),
    f("xp_reward", "number"),
    f("attempts_allowed", "number"),
    f("is_published", "boolean"),
  ],
};
export function validateContent(kind: string, data: Record<string, unknown>) {
  if (
    kind === "mini-lesson-blocks" &&
    !(data.content_type === "text" ? data.content : data.media_url)
  )
    return data.content_type === "text"
      ? "Text blocks need content."
      : "This block needs a media URL.";
  if (
    kind === "quizzes" &&
    (!Array.isArray(data.correct_answer) || !data.correct_answer.length)
  )
    return "Add at least one accepted answer.";
  if (
    kind === "quizzes" &&
    data.quiz_type === "mcq" &&
    (!Array.isArray(data.options) ||
      data.options.length < 2 ||
      (data.correct_answer as unknown[]).some(
        (a) => !(data.options as unknown[]).includes(a),
      ))
  )
    return "Multiple choice needs at least two options and answers matching those options.";
}
