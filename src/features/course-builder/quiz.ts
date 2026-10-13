import { z } from "zod";
import { str, type RecordData } from "../../shared/api/client";
import { safeMediaUrl } from "../../shared/media/urls";
export const quizTypes = {
  mcq: {
    label: "Multiple choice",
    help: "Write choices, then tick every correct choice.",
  },
  short_answer: {
    label: "Short answer",
    help: "Add an accepted answer and any alternative wording.",
  },
  one_word: {
    label: "One word",
    help: "Each accepted answer must be a single word.",
  },
  fill_blank: {
    label: "Fill in the blank",
    help: "Keep the blank spaces in your question. Enter answers in blank order.",
  },
  tap_fill: {
    label: "Tap to fill",
    help: "Keep the blank spaces in your question. Add a word bank and select answers in blank order.",
  },
};
export const quizSchema = z
  .object({
    quiz_type: z.enum([
      "mcq",
      "short_answer",
      "one_word",
      "fill_blank",
      "tap_fill",
    ]),
    question: z.string().refine((value) => !!value.trim(), "Write a question."),
    choices: z.array(z.object({ text: z.string(), correct: z.boolean() })),
    answers: z.array(z.object({ text: z.string() })),
    explanation: z.string(),
    image_url: z.string(),
    time_limit_seconds: z.string(),
    xp_reward: z.string(),
    attempts_allowed: z.string(),
    is_published: z.boolean(),
  })
  .superRefine((value, ctx) => {
    const add = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    if (value.quiz_type === "mcq") {
      if (value.choices.length < 2)
        add(["choices"], "Add at least two choices.");
      if (!value.choices.some((c) => c.correct))
        add(["choices"], "Select at least one correct choice.");
    }
    if (["mcq", "tap_fill"].includes(value.quiz_type)) {
      if (value.quiz_type === "tap_fill" && !value.choices.length)
        add(["choices"], "Add words to the word bank.");
      const seen = new Set<string>();
      value.choices.forEach((choice, index) => {
        const text = choice.text.trim();
        if (!text)
          add(["choices", index, "text"], "Enter a choice or remove this row.");
        else if (value.quiz_type === "mcq" && seen.has(text.toLowerCase()))
          add(["choices", index, "text"], "Choices must be distinct.");
        seen.add(text.toLowerCase());
      });
    }
    if (value.quiz_type !== "mcq") {
      if (!value.answers.length) add(["answers"], "Add an answer.");
      value.answers.forEach((answer, index) => {
        if (!answer.text.trim())
          add(
            ["answers", index, "text"],
            "Enter an answer or remove this row.",
          );
        else if (
          value.quiz_type === "one_word" &&
          /\s/.test(answer.text.trim())
        )
          add(["answers", index, "text"], "Use one word per answer.");
        else if (
          value.quiz_type === "tap_fill" &&
          !value.choices.some((c) => c.text.trim() === answer.text.trim())
        )
          add(
            ["answers", index, "text"],
            "Choose an answer from the word bank.",
          );
      });
    }
    for (const [name, min] of [
      ["time_limit_seconds", 1],
      ["xp_reward", 0],
      ["attempts_allowed", 1],
    ] as const) {
      if (
        value[name] &&
        (!Number.isInteger(Number(value[name])) || Number(value[name]) < min)
      )
        add([name], `Enter a whole number of ${min} or more.`);
    }
    if (value.image_url && !safeMediaUrl(value.image_url))
      add(
        ["image_url"],
        "Enter a valid HTTP or HTTPS image URL without credentials.",
      );
  });
export type QuizValues = z.infer<typeof quizSchema>;
const strings = (value: unknown) =>
  Array.isArray(value) ? value.map(str) : [];
export function quizDefaults(data: RecordData): QuizValues {
  const accepted = strings(data.correct_answer),
    choices = strings(data.options);
  const type = Object.hasOwn(quizTypes, str(data.quiz_type))
    ? (data.quiz_type as QuizValues["quiz_type"])
    : "mcq";
  return {
    quiz_type: type,
    question: str(data.question),
    choices: (choices.length
      ? choices
      : data.id || type !== "mcq"
        ? []
        : ["", ""]
    ).map((text) => ({ text, correct: accepted.includes(text) })),
    answers: (accepted.length ? accepted : [""]).map((text) => ({ text })),
    explanation: str(data.explanation),
    image_url: str(data.image_url),
    time_limit_seconds: str(data.time_limit_seconds),
    xp_reward: str(data.xp_reward),
    attempts_allowed: str(data.attempts_allowed),
    is_published: data.is_published === true,
  };
}
export function quizPayload(value: QuizValues): RecordData {
  const result: RecordData = {
    quiz_type: value.quiz_type,
    question: value.question,
    options: ["mcq", "tap_fill"].includes(value.quiz_type)
      ? value.choices.map((c) => c.text.trim())
      : [],
    correct_answer:
      value.quiz_type === "mcq"
        ? value.choices.filter((c) => c.correct).map((c) => c.text.trim())
        : value.answers.map((a) => a.text.trim()),
    explanation: value.explanation.trim() || null,
    image_url: value.image_url.trim() || null,
    time_limit_seconds: value.time_limit_seconds
      ? Number(value.time_limit_seconds)
      : null,
    is_published: value.is_published,
  };
  for (const name of ["xp_reward", "attempts_allowed"] as const)
    if (value[name] !== "") result[name] = Number(value[name]);
  return result;
}
