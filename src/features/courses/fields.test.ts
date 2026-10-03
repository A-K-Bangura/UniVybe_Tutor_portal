import { it, expect } from "vitest";
import { validateContent, courseFields } from "./fields";
import { serialize } from "../../shared/forms/SchemaForm";
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
