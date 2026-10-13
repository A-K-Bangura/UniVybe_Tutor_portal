import { it, expect } from "vitest";
import { quizDefaults, quizPayload, quizSchema } from "./quiz";
it("MCQ choice edits keep correct answers in sync and hidden fields do not leak on type changes", () => {
  const values = quizDefaults({
    quiz_type: "mcq",
    options: ["Old answer", "Other"],
    correct_answer: ["Old answer"],
  });
  values.question = "Choose the answer";
  values.choices[0].text = "Edited answer";
  expect(quizPayload(quizSchema.parse(values)).correct_answer).toEqual([
    "Edited answer",
  ]);
  values.quiz_type = "short_answer";
  values.answers = [{ text: "Accepted text" }];
  const payload = quizPayload(quizSchema.parse(values));
  expect(payload.options).toEqual([]);
  expect(payload.correct_answer).toEqual(["Accepted text"]);
});
it("blank quizzes preserve question spacing and ordered answers, including repeated answers", () => {
  const values = quizDefaults({
    quiz_type: "fill_blank",
    question: "  begins here and ends  ",
    correct_answer: ["alpha", "beta", "alpha"],
  });
  const payload = quizPayload(quizSchema.parse(values));
  expect(payload.question).toBe("  begins here and ends  ");
  expect(payload.correct_answer).toEqual(["alpha", "beta", "alpha"]);
});
it("tap fill checks bank membership and preserves answer order rather than option order", () => {
  const values = quizDefaults({
    quiz_type: "tap_fill",
    question: "Fill these gaps",
    options: ["first", "second"],
    correct_answer: ["second", "first"],
  });
  expect(quizPayload(quizSchema.parse(values)).correct_answer).toEqual([
    "second",
    "first",
  ]);
  values.answers[0].text = "not in bank";
  expect(quizSchema.safeParse(values).success).toBe(false);
});
it("quiz controls reject incomplete answers, duplicate MCQ choices, multi-word one-word answers and invalid numeric settings", () => {
  const values = quizDefaults({
    question: "Question",
    options: ["A", "A"],
    correct_answer: ["A"],
  });
  expect(quizSchema.safeParse(values).success).toBe(false);
  values.quiz_type = "one_word";
  values.answers = [{ text: "two words" }];
  expect(quizSchema.safeParse(values).success).toBe(false);
  values.answers = [{ text: "answer" }];
  values.attempts_allowed = "0";
  expect(quizSchema.safeParse(values).success).toBe(false);
  values.attempts_allowed = "3";
  values.xp_reward = "0.5";
  expect(quizSchema.safeParse(values).success).toBe(false);
  values.xp_reward = "0";
  expect(quizSchema.safeParse(values).success).toBe(true);
});
it("optional quiz settings use server defaults and explicit clears rather than writing null to nonnullable settings", () => {
  const values = quizDefaults({
    quiz_type: "short_answer",
    question: "Question",
    correct_answer: ["Answer"],
  });
  const payload = quizPayload(values);
  expect(payload).not.toHaveProperty("xp_reward");
  expect(payload).not.toHaveProperty("attempts_allowed");
  expect(payload.time_limit_seconds).toBeNull();
  expect(payload.image_url).toBeNull();
  expect(payload.explanation).toBeNull();
});
