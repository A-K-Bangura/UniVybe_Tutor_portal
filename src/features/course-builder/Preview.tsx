import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import katex from "katex";
import DOMPurify from "dompurify";
import {
  request,
  object,
  rows,
  str,
  type RecordData,
} from "../../shared/api/client";
import { Loading, ErrorPanel } from "../../shared/ui/primitives";
export function Block({ data }: { data: RecordData }) {
  if (data.content_type === "text") {
    if (data.text_type === "formula") {
      let html: string;
      try {
        html = katex.renderToString(str(data.content), {
          trust: false,
          throwOnError: true,
        });
      } catch {
        return <p className="error">Invalid formula syntax</p>;
      }
      return (
        <div
          className="formula"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
        />
      );
    }
    return (
      <div className={`text-block ${str(data.text_type)}`}>
        <small>
          {data.text_type !== "plain"
            ? str(data.text_type).replaceAll("_", " ")
            : ""}
        </small>
        <p className="prewrap">{str(data.content)}</p>
      </div>
    );
  }
  const url = str(data.media_url);
  let parsed: URL;
  try {
    parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) return null;
  } catch {
    return <p>Media URL unavailable</p>;
  }
  if (data.content_type === "image")
    return (
      <img
        className="preview-image"
        src={url}
        alt={str(object(data.media_metadata).caption) || "Lesson illustration"}
      />
    );
  if (data.content_type === "video" && /\.(mp4|webm)(\?|$)/.test(url))
    return <video controls src={url} className="preview-image" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      Open {str(data.content_type)} ↗
    </a>
  );
}
async function loadTree(course: RecordData) {
  const modules = rows(
    object((await request(`tutor/courses/${str(course.id)}/modules`)).data)
      .modules,
  );
  for (const module of modules) {
    const lessons = rows(
      object((await request(`tutor/modules/${str(module.id)}/lessons`)).data)
        .lessons,
    );
    module.lessons = lessons;
    for (const lesson of lessons) {
      lesson.quizzes = rows(
        object((await request(`tutor/lessons/${str(lesson.id)}/quizzes`)).data)
          .quizzes,
      );
      const minis = rows(
        object(
          (await request(`tutor/lessons/${str(lesson.id)}/mini-lessons`)).data,
        ).mini_lessons,
      );
      lesson.mini_lessons = minis;
      for (const mini of minis)
        mini.blocks = rows(
          object(
            (await request(`tutor/mini-lessons/${str(mini.id)}/blocks`)).data,
          ).blocks,
        );
    }
  }
  return modules;
}
export function ContentPreview({ course }: { course: RecordData }) {
  const [answers, setAnswers] = useState(false),
    q = useQuery({
      queryKey: ["preview", course.id],
      queryFn: () => loadTree(course),
    });
  return (
    <>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorPanel error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          <label>
            <input
              type="checkbox"
              checked={answers}
              onChange={(e) => setAnswers(e.target.checked)}
            />{" "}
            Show answer review
          </label>
          {q.data.map((module) => (
            <section key={str(module.id)}>
              <h2>{str(module.title)}</h2>
              {rows(module.lessons).map((lesson) => (
                <section key={str(lesson.id)}>
                  <h3>{str(lesson.title)}</h3>
                  {rows(lesson.mini_lessons).map((mini) => (
                    <section key={str(mini.id)}>
                      <h4>{str(mini.title)}</h4>
                      {rows(mini.blocks).map((block) => (
                        <Block key={str(block.id)} data={block} />
                      ))}
                    </section>
                  ))}
                  {rows(lesson.quizzes).map((quiz) => (
                    <div className="quiz-preview" key={str(quiz.id)}>
                      <strong>{str(quiz.question)}</strong>
                      {quiz.quiz_type !== "mcq" && (
                        <label>
                          Answer preview
                          <input
                            aria-label={`Answer to ${str(quiz.question)}`}
                            placeholder="Your answer"
                          />
                        </label>
                      )}
                      {Array.isArray(quiz.options) &&
                        (quiz.options as unknown[]).map((o, i) => (
                          <label key={i}>
                            <input type="radio" name={`quiz-${str(quiz.id)}`} />{" "}
                            {str(o)}
                          </label>
                        ))}
                      {answers && (
                        <p>
                          Answer:{" "}
                          {Array.isArray(quiz.correct_answer)
                            ? quiz.correct_answer.map(str).join(", ")
                            : ""}
                          <br />
                          {str(quiz.explanation)}
                        </p>
                      )}
                    </div>
                  ))}
                </section>
              ))}
            </section>
          ))}
        </>
      )}
    </>
  );
}
