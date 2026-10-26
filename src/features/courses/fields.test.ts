import { it, expect } from "vitest";
import { validateContent, courseFields } from "./fields";
import { serialize } from "../../shared/forms/SchemaForm";
import { roadmapFields } from "../roadmaps/config";
import { resourceFields } from "../resources/config";
import { levelLabel } from "./levels";

it("keeps general as an explicit string and lets content levels be cleared", () => {
  for (const fields of [courseFields, roadmapFields]) {
    expect(serialize(fields, { level: "general" }).level).toBe("general");
    expect(serialize(fields, { level: "200" }).level).toBe("200");
    expect(serialize(fields, { level: "" }).level).toBeNull();
    expect(serialize(fields, { level: null }).level).toBeNull();
    expect(serialize(fields, {})).not.toHaveProperty("level");
    expect(
      fields.find((field) => field.name === "level")?.options,
    ).toContainEqual({ value: "general", label: "General — wider audience" });
  }
  expect(
    resourceFields.find((field) => field.name === "level")?.options,
  ).not.toContain("general");
  expect(
    resourceFields.find((field) => field.name === "level")?.options,
  ).not.toContainEqual({ value: "general", label: "General — wider audience" });
  expect(serialize(resourceFields, { level: "" })).not.toHaveProperty("level");
  expect(levelLabel("general")).toBe("General — wider audience");
  expect(levelLabel(null)).toBe("");
});
it("serializes organization-only courses and explicit organization clearing", () => {
  const payload = serialize(courseFields, {
    title: "Organization training",
    description: "Independent training",
    organization_id: "42",
    university_id: "",
    faculty_id: "",
    department_id: "",
    academic_module_id: "",
  });
  expect(payload).toMatchObject({
    organization_id: 42,
    university_id: null,
    faculty_id: null,
    department_id: null,
    academic_module_id: null,
  });
  expect(serialize(courseFields, { organization_id: "" })).toMatchObject({
    organization_id: null,
  });
  expect(serialize(courseFields, {})).not.toHaveProperty("organization_id");
});
it("omits paid-only suggestions for a free course", () => {
  const payload = serialize(courseFields, {
    title: "Course",
    description: "Learning",
    suggested_is_paid: false,
    suggested_price: "0",
    suggested_coin_reward: "100",
  });
  expect(payload).not.toHaveProperty("suggested_price");
  expect(payload).not.toHaveProperty("suggested_coin_reward");
});
it("requires content for text and media for other block types", () => {
  expect(
    validateContent("mini-lesson-blocks", { content_type: "image" }),
  ).toContain("media URL");
  expect(
    validateContent("mini-lesson-blocks", {
      content_type: "text",
      content: "Hello",
    }),
  ).toBeUndefined();
});
it("rejects MCQ answer values outside options", () => {
  expect(
    validateContent("quizzes", {
      quiz_type: "mcq",
      options: ["A", "B"],
      correct_answer: ["C"],
    }),
  ).toContain("matching");
  expect(
    validateContent("quizzes", {
      quiz_type: "mcq",
      options: ["A", "B"],
      correct_answer: ["B"],
    }),
  ).toBeUndefined();
});
