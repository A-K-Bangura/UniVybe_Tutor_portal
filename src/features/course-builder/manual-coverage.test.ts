import { describe, expect, it } from "vitest";
import draft from "../../../docs/course-creation/course-draft.json";
import { blockDefaults, blockIssues, blockTypes, textTypes } from "./blocks";
import { quizDefaults, quizSchema, quizTypes } from "./quiz";

describe("local educator training draft", () => {
  const lessons = draft.modules.flatMap((module) => module.lessons);
  const quizzes = lessons.flatMap((lesson) => lesson.quizzes);
  const blocks = lessons.flatMap((lesson) =>
    lesson.mini_lessons.flatMap((mini) => mini.blocks),
  );
  it("covers every authorable format with content or an explicit pending asset", () => {
    const content = [...blocks, ...draft.pending_assets];
    expect(new Set(content.map((block) => block.content_type))).toEqual(
      new Set(blockTypes),
    );
    expect(
      new Set(
        content.flatMap((block) =>
          "text_type" in block ? [block.text_type] : [],
        ),
      ),
    ).toEqual(new Set(textTypes));
    expect(new Set(quizzes.map((quiz) => quiz.quiz_type))).toEqual(
      new Set(Object.keys(quizTypes)),
    );
  });
  it("keeps draft examples valid and estimates consistent with the outline", () => {
    expect(draft.course.estimated_lessons_count).toBe(lessons.length);
    expect(draft.course.estimated_quizzes_count).toBe(quizzes.length);
    for (const block of blocks) {
      expect(blockIssues(blockDefaults(block))).toEqual({});
      expect(block.is_published).toBe(false);
    }
    for (const quiz of quizzes) {
      expect(quizSchema.safeParse(quizDefaults(quiz)).success).toBe(true);
      expect(quiz.is_published).toBe(false);
    }
  });
});
