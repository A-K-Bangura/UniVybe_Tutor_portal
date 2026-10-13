import { useEffect, useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useBlocker } from "react-router-dom";
import {
  quizSchema,
  quizDefaults,
  quizPayload,
  quizTypes,
  type QuizValues,
} from "./quiz";
import { problem, str, type RecordData } from "../../shared/api/client";
import { ErrorPanel, Modal } from "../../shared/ui/primitives";
import { QuizMediaPreview } from "./Preview";

export function QuizForm({
  initial,
  submit,
  onDirty,
  checkLatest,
  onLoaded,
}: {
  initial: RecordData;
  submit: (values: RecordData) => Promise<void>;
  onDirty: (dirty: boolean) => void;
  checkLatest: () => Promise<RecordData[]>;
  onLoaded: (record: RecordData) => void;
}) {
  const form = useForm<QuizValues>({
    defaultValues: quizDefaults(initial),
    resolver: zodResolver(quizSchema),
  });
  const choices = useFieldArray({ control: form.control, name: "choices" }),
    answers = useFieldArray({ control: form.control, name: "answers" });
  const live = useWatch({ control: form.control });
  const type = live.quiz_type || "mcq",
    ordered = type === "fill_blank" || type === "tap_fill";
  const { isDirty, isSubmitting, errors } = form.formState;
  const [error, setError] = useState<unknown>(),
    [uncertain, setUncertain] = useState(false),
    [saved, setSaved] = useState(false),
    [checking, setChecking] = useState(false),
    [latest, setLatest] = useState<RecordData>(),
    [checkedMessage, setCheckedMessage] = useState(""),
    [extrasOpen, setExtrasOpen] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false);
  const blocker = useBlocker(isDirty && !isSubmitting);
  useEffect(() => {
    onDirty(isDirty);
    const warn = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      onDirty(false);
    };
  }, [isDirty, onDirty]);
  const showInvalidSections = (names: string[]) => {
    if (names.some((name) => ["image_url", "explanation"].includes(name)))
      setExtrasOpen(true);
    if (
      names.some((name) =>
        ["time_limit_seconds", "xp_reward", "attempts_allowed"].includes(name),
      )
    )
      setSettingsOpen(true);
  };
  const save = form.handleSubmit(
    async (values) => {
      if (uncertain) return;
      setError(undefined);
      setSaved(false);
      try {
        await submit(quizPayload(values));
        form.reset(values);
        setSaved(true);
        if (blocker.state === "blocked") blocker.proceed();
      } catch (e) {
        setError(e);
        if (problem(e).uncertain) setUncertain(true);
        showInvalidSections(Object.keys(problem(e).fields));
        for (const [key, messages] of Object.entries(problem(e).fields)) {
          const path = key
            .replace(/^options\.(\d+)$/, "choices.$1.text")
            .replace(
              /^correct_answer\.(\d+)$/,
              type === "mcq" ? "choices" : "answers.$1.text",
            );
          form.setError(path as keyof QuizValues, {
            message: messages.join(" "),
          });
        }
      }
    },
    (invalid) => showInvalidSections(Object.keys(invalid)),
  );
  const errorList = Object.entries(problem(error).fields);
  async function checkCurrent() {
    if (checking) return;
    setChecking(true);
    setLatest(undefined);
    setCheckedMessage("");
    try {
      const records = await checkLatest();
      if (!initial.id) {
        setCheckedMessage(
          "The lesson's saved quizzes have been refreshed. Review the outline before creating another quiz; this draft remains locked to avoid duplicates.",
        );
        return;
      }
      const record = records.find((value) => str(value.id) === str(initial.id));
      if (!record) {
        setCheckedMessage(
          "This quiz is no longer in the lesson. Your draft is kept and saving remains blocked.",
        );
        return;
      }
      const server = quizPayload(quizDefaults(record)),
        draft = quizPayload(form.getValues());
      if (
        Object.entries(draft).every(
          ([key, value]) =>
            JSON.stringify(server[key]) === JSON.stringify(value),
        )
      ) {
        form.reset(form.getValues());
        setUncertain(false);
        setError(undefined);
        setSaved(true);
        onLoaded(record);
        setCheckedMessage("The saved quiz matches your draft.");
      } else {
        setLatest(record);
        setCheckedMessage(
          "The saved version differs from your draft. Review it below; loading it will replace this draft.",
        );
      }
    } catch (e) {
      setError(e);
    } finally {
      setChecking(false);
    }
  }
  return (
    <>
      <form className="editor-form quiz-form" onSubmit={save} noValidate>
        {Object.keys(errors).length > 0 && (
          <p className="field-error" role="alert">
            Check the highlighted fields before saving.
          </p>
        )}
        {error !== undefined && (
          <ErrorPanel
            error={error}
            retry={uncertain ? () => void checkCurrent() : undefined}
          />
        )}
        {checking && <p role="status">Checking the saved quiz…</p>}
        {checkedMessage && <p role="status">{checkedMessage}</p>}
        {latest && (
          <section className="form-section">
            <h3>Current saved version</h3>
            <p className="prewrap">{str(latest.question)}</p>
            <p>
              Answers:{" "}
              {Array.isArray(latest.correct_answer)
                ? latest.correct_answer.map(str).join(" · ")
                : "Unavailable"}
            </p>
            <button
              type="button"
              onClick={() => {
                form.reset(quizDefaults(latest));
                onLoaded(latest);
                setUncertain(false);
                setError(undefined);
                setLatest(undefined);
                setSaved(false);
                setCheckedMessage("Saved version loaded.");
              }}
            >
              Load saved version
            </button>
          </section>
        )}
        {errorList.length > 0 && (
          <ul className="field-error" role="alert">
            {errorList.map(([key, messages]) => (
              <li key={key}>
                {key
                  .replace("correct_answer", "Answer")
                  .replace("options", "Choice")}
                : {messages.join(" ")}
              </li>
            ))}
          </ul>
        )}
        {uncertain && (
          <p className="notice">
            The save result is uncertain. Check current state before saving
            again. Your draft is kept here.
          </p>
        )}
        <fieldset disabled={isSubmitting || uncertain}>
          <label>
            Quiz type
            <select
              aria-label="Quiz type"
              {...form.register("quiz_type")}
              onChange={(event) => {
                const next = event.target.value as QuizValues["quiz_type"];
                form.setValue("quiz_type", next, { shouldDirty: true });
                form.clearErrors();
                if (
                  next === "tap_fill" &&
                  form.getValues("choices").every((c) => !c.text.trim())
                )
                  choices.replace([]);
                if (next === "mcq" && !form.getValues("choices").length)
                  choices.replace([
                    { text: "", correct: false },
                    { text: "", correct: false },
                  ]);
              }}
            >
              {Object.entries(quizTypes).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </label>
          <p className="muted">{quizTypes[type].help}</p>
          <label>
            Question *
            <textarea
              aria-label="Quiz question"
              rows={4}
              {...form.register("question")}
              placeholder={
                ordered
                  ? "Write your question, keeping its blank spaces."
                  : "What would you like the learner to answer?"
              }
            />
          </label>
          {errors.question && (
            <p className="field-error" role="alert">
              {errors.question.message}
            </p>
          )}
          {ordered && /^\s|\s$/.test(live.question || "") && (
            <p className="notice">
              The server trims spaces at the start and end of questions. Keep
              blank spaces between visible text; blanks at the edges need
              backend support.
            </p>
          )}
          {(type === "mcq" || type === "tap_fill") && (
            <section className="form-section">
              <h3>{type === "mcq" ? "Choices" : "Word bank"}</h3>
              {choices.fields.map((choice, index) => (
                <div className="quiz-choice-row" key={choice.id}>
                  {type === "mcq" && (
                    <label className="quiz-correct-choice">
                      <input
                        type="checkbox"
                        aria-label={`Choice ${index + 1} is correct`}
                        {...form.register(`choices.${index}.correct`)}
                      />{" "}
                      Correct
                    </label>
                  )}
                  <label>
                    {type === "mcq"
                      ? `Choice ${index + 1}`
                      : `Word ${index + 1}`}
                    <input
                      aria-label={
                        type === "mcq"
                          ? `Choice ${index + 1}`
                          : `Word ${index + 1}`
                      }
                      {...form.register(`choices.${index}.text`)}
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={`Remove ${type === "mcq" ? "choice" : "word"} ${index + 1}`}
                    onClick={() => choices.remove(index)}
                  >
                    Remove
                  </button>
                  {errors.choices?.[index]?.text && (
                    <p className="field-error" role="alert">
                      {errors.choices[index]?.text?.message}
                    </p>
                  )}
                </div>
              ))}
              {(errors.choices?.message || errors.choices?.root?.message) && (
                <p className="field-error" role="alert">
                  {errors.choices.message || errors.choices.root?.message}
                </p>
              )}
              <button
                type="button"
                onClick={() => choices.append({ text: "", correct: false })}
              >
                {type === "mcq" ? "Add choice" : "Add word"}
              </button>
            </section>
          )}
          {type !== "mcq" && (
            <section className="form-section">
              <h3>{ordered ? "Answers in blank order" : "Accepted answers"}</h3>
              {answers.fields.map((answer, index) => (
                <div className="quiz-answer-row" key={answer.id}>
                  <label>
                    {ordered
                      ? `Blank ${index + 1} answer`
                      : index === 0
                        ? "Answer"
                        : `Alternative answer ${index + 1}`}
                    {type === "tap_fill" ? (
                      <select
                        aria-label={`Blank ${index + 1} answer`}
                        {...form.register(`answers.${index}.text`)}
                      >
                        <option value="">Select a word</option>
                        {live.answers?.[index]?.text &&
                          !live.choices?.some(
                            (c) =>
                              c.text?.trim() === live.answers?.[index]?.text,
                          ) && (
                            <option value={live.answers[index].text}>
                              Previous answer: {live.answers[index].text}
                            </option>
                          )}
                        {live.choices
                          ?.filter((c) => c.text?.trim())
                          .map((c, i) => (
                            <option key={i} value={c.text?.trim()}>
                              {c.text?.trim()}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <input
                        aria-label={
                          ordered
                            ? `Blank ${index + 1} answer`
                            : index === 0
                              ? "Accepted answer"
                              : `Alternative answer ${index + 1}`
                        }
                        {...form.register(`answers.${index}.text`)}
                      />
                    )}
                  </label>
                  <button
                    type="button"
                    aria-label={`Remove answer ${index + 1}`}
                    disabled={answers.fields.length === 1}
                    onClick={() => answers.remove(index)}
                  >
                    Remove
                  </button>
                  {ordered && (
                    <>
                      <button
                        type="button"
                        aria-label={`Move blank answer ${index + 1} up`}
                        disabled={index === 0}
                        onClick={() => answers.move(index, index - 1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Move blank answer ${index + 1} down`}
                        disabled={index === answers.fields.length - 1}
                        onClick={() => answers.move(index, index + 1)}
                      >
                        ↓
                      </button>
                    </>
                  )}
                  {errors.answers?.[index]?.text && (
                    <p className="field-error" role="alert">
                      {errors.answers[index]?.text?.message}
                    </p>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => answers.append({ text: "" })}
              >
                {ordered ? "Add blank answer" : "Add alternative answer"}
              </button>
            </section>
          )}
          <details
            className="quiz-optional"
            open={extrasOpen}
            onToggle={(event) => setExtrasOpen(event.currentTarget.open)}
          >
            <summary>Explanation and image (optional)</summary>
            <label>
              Explain the answer
              <textarea rows={3} {...form.register("explanation")} />
            </label>
            <label>
              Image URL
              <input
                aria-label="Quiz image URL"
                {...form.register("image_url")}
              />
            </label>
            {errors.image_url && (
              <p className="field-error" role="alert">
                {errors.image_url.message}
              </p>
            )}
            <QuizMediaPreview
              data={{ image_url: live.image_url, question: live.question }}
            />
          </details>
          <details
            className="quiz-optional"
            open={settingsOpen}
            onToggle={(event) => setSettingsOpen(event.currentTarget.open)}
          >
            <summary>Quiz settings (optional)</summary>
            <div className="form-grid">
              {(
                [
                  ["time_limit_seconds", "Time limit (seconds)", 1],
                  ["xp_reward", "XP reward", 0],
                  ["attempts_allowed", "Allowed attempts", 1],
                ] as const
              ).map(([name, title, min]) => (
                <label key={name}>
                  {title}
                  <input
                    aria-label={title}
                    aria-invalid={!!errors[name]}
                    type="number"
                    step={1}
                    min={min}
                    {...form.register(name)}
                  />
                  {errors[name] && (
                    <small className="field-error" role="alert">
                      {errors[name].message}
                    </small>
                  )}
                </label>
              ))}
            </div>
            <p className="muted">
              An empty time limit means untimed. Leave reward and attempts blank
              to keep existing values or use the defaults for a new quiz.
            </p>
            <label>
              <input type="checkbox" {...form.register("is_published")} /> Make
              this quiz available when the course is published
            </label>
          </details>
          <details className="quiz-optional">
            <summary>Preview question</summary>
            <p className="prewrap">
              {live.question || "Your question will appear here."}
            </p>
            <QuizMediaPreview
              data={{ image_url: live.image_url, question: live.question }}
            />
            {type === "mcq" &&
              live.choices?.map((c, i) => (
                <p key={i}>
                  {i + 1}. {c.text || "Empty choice"}
                  {c.correct ? " ✓" : ""}
                </p>
              ))}
            {type === "tap_fill" && (
              <p>
                Word bank:{" "}
                {live.choices
                  ?.map((c) => c.text)
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {type !== "mcq" && (
              <details>
                <summary>
                  {ordered
                    ? "View ordered answer key"
                    : "View accepted answers"}
                </summary>
                {live.answers?.map((a, i) => (
                  <p key={i}>
                    {ordered ? `Blank ${i + 1}` : `Answer ${i + 1}`}:{" "}
                    {a.text || "Not entered"}
                  </p>
                ))}
              </details>
            )}
          </details>
        </fieldset>
        <div className="save-bar">
          <span role="status">
            {isSubmitting
              ? "Saving…"
              : isDirty
                ? "Unsaved changes"
                : saved
                  ? "Saved and confirmed"
                  : "Ready to edit"}
          </span>
          <button
            type="submit"
            className="primary"
            disabled={isSubmitting || uncertain}
          >
            {isSubmitting
              ? "Saving…"
              : initial.id
                ? "Save quiz"
                : "Create quiz"}
          </button>
        </div>
      </form>
      <Modal
        title="You have unsaved changes"
        open={blocker.state === "blocked"}
        onClose={() => blocker.state === "blocked" && blocker.reset()}
      >
        <p>Save your quiz before leaving this editor.</p>
        <div className="actions">
          <button
            onClick={() => blocker.state === "blocked" && blocker.reset()}
          >
            Stay
          </button>
          <button
            onClick={() => {
              form.reset();
              if (blocker.state === "blocked") blocker.proceed();
            }}
          >
            Discard
          </button>
          <button
            className="primary"
            disabled={uncertain}
            onClick={() => void save()}
          >
            Save and leave
          </button>
        </div>
      </Modal>
    </>
  );
}
