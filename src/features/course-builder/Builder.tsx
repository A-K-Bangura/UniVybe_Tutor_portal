import { createContext, useContext, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { SortableList } from "../../shared/ui/SortableList";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  request,
  object,
  rows,
  str,
  entity,
  type RecordData,
} from "../../shared/api/client";
import {
  Header,
  Badge,
  Loading,
  ErrorPanel,
  Modal,
} from "../../shared/ui/primitives";
import { QuizForm } from "./QuizForm";
import { BlockForm } from "./BlockForm";
import { blockTitle } from "./blocks";
import { ChevronRight, Link2, Terminal } from "lucide-react";
import { SchemaForm } from "../../shared/forms/SchemaForm";
import {
  contentFields,
  courseFields,
  validateContent,
} from "../courses/fields";
import { Decision } from "../reviews/Decision";
import { useSession } from "../../shared/auth/session";
import { save } from "../catalog/service";
import { ContentPreview, CourseDetailsPreview } from "./Preview";
import { Attachments, type PendingSequence } from "../resources/Attachments";
import { ResizableBuilder } from "./ResizableBuilder";
interface Node {
  kind: string;
  data: RecordData;
  parentId: number;
  order: number;
  ancestors?: string[];
}
const OutlineContext = createContext<{
  selected: Node;
  expanded: ReadonlySet<string>;
  setExpanded: (key: string, open: boolean) => void;
} | null>(null);
const keys: Record<string, string> = {
  modules: "module",
  lessons: "lesson",
  "mini-lessons": "mini_lesson",
  "mini-lesson-blocks": "block",
  quizzes: "quiz",
};
const outlineLabels: Record<string, { title: string; add: string }> = {
  modules: { title: "Modules", add: "Add module" },
  lessons: { title: "Lessons", add: "Add lesson" },
  "mini-lessons": { title: "Mini-lessons", add: "Add mini-lesson" },
  "mini-lesson-blocks": { title: "Content blocks", add: "Add content block" },
  quizzes: { title: "Quizzes", add: "Add quiz" },
};
const parents: Record<string, string> = {
  modules: "course_id",
  lessons: "module_id",
  "mini-lessons": "lesson_id",
  "mini-lesson-blocks": "mini_lesson_id",
  quizzes: "lesson_id",
};
const children: Record<string, { kind: string; path: string; key: string }[]> =
  {
    courses: [{ kind: "modules", path: "courses", key: "modules" }],
    modules: [{ kind: "lessons", path: "modules", key: "lessons" }],
    lessons: [
      { kind: "mini-lessons", path: "lessons", key: "mini_lessons" },
      { kind: "quizzes", path: "lessons", key: "quizzes" },
    ],
    "mini-lessons": [
      { kind: "mini-lesson-blocks", path: "mini-lessons", key: "blocks" },
    ],
  };
export function CourseBuilder({
  course,
  id,
  onAction,
  action,
  closeAction,
}: {
  course: RecordData;
  id: string;
  onAction: (a: string) => void;
  action?: string;
  closeAction: () => void;
}) {
  const cache = useQueryClient(),
    navigate = useNavigate(),
    role = useSession((s) => s.user!.role.name),
    [node, setNode] = useState<Node>({
      kind: "courses",
      data: course,
      parentId: 0,
      order: 0,
    }),
    [dirty, setDirty] = useState(false),
    [pending, setPending] = useState<Node>(),
    [preview, setPreview] = useState(false),
    [error, setError] = useState<unknown>(),
    [deleteOpen, setDeleteOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const [attachmentsDirty, setAttachmentsDirty] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const setOutlineExpanded = (key: string, open: boolean) => {
    setExpanded((previous) => {
      if (previous.has(key) === open) return previous;
      const next = new Set(previous);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  };
  const attachments = useRef<PendingSequence>(null);
  const select = (next: Node) => {
    if (dirty) setPending(next);
    else setNode(next);
  };
  const submit = async () => {
    if (dirty) {
      setError(new Error("Save the selected editor before submitting."));
      return;
    }
    setBusy(true);
    try {
      const r = await request(`tutor/courses/${id}/publish`, "POST");
      await cache.invalidateQueries();
      setError(undefined);
      const saved = entity(r, "course");
      if (saved.status !== "pending_approval")
        setError(new Error(str(r.message)));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const saveNode = async (values: RecordData) => {
    let saved: RecordData;
    if (node.kind === "courses")
      saved = object(await save("courses", values, id));
    else
      saved = entity(
        await request(
          `tutor/content/${node.kind}${node.data.id ? `/${str(node.data.id)}` : ""}`,
          node.data.id ? "PUT" : "POST",
          {
            ...values,
            [parents[node.kind]]: node.parentId,
            order_index: node.order,
          },
        ),
        keys[node.kind],
      );
    await cache.invalidateQueries();
    if (node.kind === "courses") await attachments.current?.save();
    setDirty(false);
    if (pending) {
      setNode(pending);
      setPending(undefined);
    } else setNode({ ...node, data: { ...node.data, ...saved } });
  };
  return (
    <>
      <Header
        title={str(course.title)}
        subtitle="Build one focused lesson at a time. Save each editor separately."
      >
        <Badge value={course.status} />
        <button onClick={() => setPreview(true)}>Preview course</button>
        <Link className="button" to={`/courses/${id}/analytics`}>
          Course insights
        </Link>
        <button
          className="danger-text"
          disabled={dirty}
          onClick={() => onAction("delete")}
        >
          Delete course
        </button>
        <button
          className="primary"
          disabled={busy || dirty}
          onClick={() => void submit()}
        >
          Submit for approval
        </button>
        {role === "admin" && (
          <>
            <button onClick={() => onAction("approve")}>Approve course</button>
            <button onClick={() => onAction("reject")}>Reject</button>
            <button onClick={() => onAction("pricing")}>Final pricing</button>
            <button onClick={() => onAction("coin-reward")}>Coin reward</button>
          </>
        )}
      </Header>
      {error !== undefined && (
        <ErrorPanel
          error={error}
          retry={() => void cache.invalidateQueries()}
        />
      )}
      <ResizableBuilder
        outline={
          <OutlineContext.Provider
            value={{
              selected: node,
              expanded,
              setExpanded: setOutlineExpanded,
            }}
          >
            <aside
              className="course-outline panel custom-scroll"
              tabIndex={0}
              aria-label="Scrollable course outline"
            >
              <h2>Course outline</h2>
              <p className="muted">
                Module → lesson → mini-lesson → content blocks. Add quizzes to a
                lesson.
              </p>
              <button
                className="outline-node"
                aria-current={node.kind === "courses" ? "true" : undefined}
                onClick={() =>
                  select({
                    kind: "courses",
                    data: course,
                    parentId: 0,
                    order: 0,
                  })
                }
              >
                Course details
              </button>
              <Branch kind="courses" data={course} select={select} />
            </aside>
          </OutlineContext.Provider>
        }
      >
        <div
          className="panel editor-panel custom-scroll"
          tabIndex={0}
          role="region"
          aria-label="Scrollable content editor"
        >
          <div className="editor-heading">
            <div>
              <span className="eyebrow">{node.kind.replaceAll("-", " ")}</span>
              <h2>
                {str(node.data.title || node.data.question) ||
                  `New ${keys[node.kind]}`}
              </h2>
            </div>
            {node.kind !== "courses" && node.data.id != null && (
              <button
                className="danger-text"
                onClick={() => setDeleteOpen(true)}
              >
                Delete item
              </button>
            )}
          </div>
          {node.kind === "quizzes" ? (
            <QuizForm
              key={`quiz-${str(node.data.id) || "new"}-${node.parentId}`}
              initial={node.data}
              onDirty={setDirty}
              submit={saveNode}
              checkLatest={async () => {
                const records = rows(
                  object(
                    (await request(`tutor/lessons/${node.parentId}/quizzes`))
                      .data,
                  ).quizzes,
                );
                cache.setQueryData(
                  ["content", "quizzes", node.parentId],
                  records,
                );
                return records;
              }}
              onLoaded={(record) => setNode({ ...node, data: record })}
            />
          ) : node.kind === "mini-lesson-blocks" ? (
            <BlockForm
              key={`block-${str(node.data.id) || "new"}-${node.parentId}`}
              initial={node.data}
              submit={saveNode}
              onDirty={setDirty}
              checkLatest={async () => {
                const records = rows(
                  object(
                    (
                      await request(
                        `tutor/mini-lessons/${node.parentId}/blocks`,
                      )
                    ).data,
                  ).blocks,
                );
                cache.setQueryData(
                  ["content", "mini-lesson-blocks", node.parentId],
                  records,
                );
                return records;
              }}
              onLoaded={(record) => setNode({ ...node, data: record })}
            />
          ) : (
            <SchemaForm
              preview={
                node.kind === "courses"
                  ? (values) => <CourseDetailsPreview data={values} />
                  : undefined
              }
              key={`${node.kind}-${str(node.data.id) || "new"}-${node.parentId}`}
              fields={
                node.kind === "courses"
                  ? courseFields
                  : contentFields[node.kind]
              }
              initial={node.data}
              onDirty={setDirty}
              externalDirty={attachmentsDirty}
              onDiscard={() => attachments.current?.discard()}
              validate={(values) =>
                node.kind === "courses" &&
                values.suggested_is_paid === true &&
                !(Number(values.suggested_price) > 0)
                  ? "A paid suggestion requires a positive price."
                  : validateContent(node.kind, values)
              }
              submit={saveNode}
            />
          )}
          {node.kind === "courses" && (
            <Attachments
              key={id}
              id={id}
              onDirty={setAttachmentsDirty}
              saveRef={attachments}
            />
          )}
        </div>
      </ResizableBuilder>
      <Modal
        title="Unsaved editor"
        open={!!pending}
        onClose={() => setPending(undefined)}
      >
        <p>
          Save using the selected editor’s Save button, discard these changes,
          or stay.
        </p>
        <div className="actions">
          <button onClick={() => setPending(undefined)}>Stay</button>
          <button
            onClick={() => {
              if (pending) setNode(pending);
              setPending(undefined);
              setDirty(false);
              attachments.current?.discard();
            }}
          >
            Discard and switch
          </button>
          <button
            className="primary"
            onClick={() => {
              setPending(pending);
              document
                .querySelector<HTMLButtonElement>(
                  '.editor-panel button[type="submit"]',
                )
                ?.click();
            }}
          >
            Save and switch
          </button>
        </div>
      </Modal>
      <Modal
        title="Creator course preview"
        open={preview}
        onClose={() => setPreview(false)}
      >
        <p>
          Authored content preview. Public paid-course visitors see the outline
          before enrolling.
        </p>
        <ContentPreview course={course} />
      </Modal>
      <Modal
        title="Delete content item"
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      >
        <p>
          Delete this {keys[node.kind]} and its dependent content? This cannot
          be undone in the portal.
        </p>
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await request(
                `tutor/content/${node.kind}/${str(node.data.id)}`,
                "DELETE",
              );
              setNode({ kind: "courses", data: course, parentId: 0, order: 0 });
              await cache.invalidateQueries();
              setDeleteOpen(false);
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          Confirm deletion
        </button>
      </Modal>
      {action && (
        <Decision
          kind="courses"
          id={id}
          action={action}
          snapshot={course}
          creator={role !== "admin"}
          onDeleted={() => navigate("/courses")}
          onClose={closeAction}
        />
      )}
    </>
  );
}
function Branch({
  kind,
  data,
  select,
  ancestors = [],
}: {
  kind: string;
  data: RecordData;
  select: (n: Node) => void;
  ancestors?: string[];
}) {
  return (
    <>
      {(children[kind] || []).map((child) => (
        <Children
          key={child.kind}
          parent={data}
          descriptor={child}
          select={select}
          ancestors={ancestors}
        />
      ))}
    </>
  );
}
function Children({
  parent,
  descriptor: d,
  select,
  ancestors,
}: {
  parent: RecordData;
  descriptor: { kind: string; path: string; key: string };
  select: (n: Node) => void;
  ancestors: string[];
}) {
  const outline = useContext(OutlineContext)!;
  const [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    cache = useQueryClient();
  const q = useQuery({
    queryKey: ["content", d.kind, parent.id],
    queryFn: async ({ signal }) => {
      const value = object(
        (
          await request(
            `tutor/${d.path}/${str(parent.id)}/${d.key.replaceAll("_", "-")}`,
            "GET",
            undefined,
            signal,
          )
        ).data,
      )[d.key];
      if (!Array.isArray(value)) throw new Error("Unexpected child collection");
      return rows(value);
    },
  });
  const persist = async (next: RecordData[]) => {
    setBusy(true);
    try {
      for (let i = 0; i < next.length; i++)
        await request(`tutor/content/${d.kind}/${str(next[i].id)}`, "PUT", {
          order_index: i,
        });
      setError(undefined);
    } catch (e) {
      setError(
        new Error(
          `Some positions may have saved. The persisted order has been reloaded. ${e instanceof Error ? e.message : ""}`,
        ),
      );
    } finally {
      await cache.invalidateQueries({
        queryKey: ["content", d.kind, parent.id],
      });
      setBusy(false);
    }
  };
  const move = async (index: number, offset: number) => {
    if (!q.data) return;
    const next = [...q.data];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    await persist(next);
  };
  return (
    <div className="outline-group">
      <div className="outline-group-head">
        <strong>{outlineLabels[d.kind].title}</strong>
        <button
          disabled={busy || q.isPending || q.isError}
          aria-current={
            !outline.selected.data.id &&
            outline.selected.kind === d.kind &&
            outline.selected.parentId === Number(parent.id)
              ? "true"
              : undefined
          }
          onClick={() =>
            select({
              kind: d.kind,
              data: {},
              parentId: Number(parent.id),
              order: q.data?.length || 0,
              ancestors,
            })
          }
        >
          {outlineLabels[d.kind].add}
        </button>
      </div>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorPanel error={q.error} retry={() => void q.refetch()} />
      ) : (
        <SortableList
          items={q.data}
          id={(item) => str(item.id)}
          disabled={busy}
          onChange={(next) => void persist(next)}
          render={(item, index) => {
            const key = `${d.kind}:${str(item.id)}`;
            const open = outline.expanded.has(key);
            const selected =
              outline.selected.kind === d.kind &&
              str(outline.selected.data.id) === str(item.id);
            const activeBranch = outline.selected.ancestors?.includes(key);
            const title = str(item.title || item.question) || blockTitle(item);
            return (
              <details
                key={key}
                className={`outline-item${activeBranch ? " outline-active-branch" : ""}`}
                open={open}
                onToggle={(event) => {
                  if (event.target === event.currentTarget)
                    outline.setExpanded(key, event.currentTarget.open);
                }}
              >
                <summary>
                  <button
                    className="outline-node"
                    aria-current={selected ? "true" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      select({
                        kind: d.kind,
                        data: item,
                        parentId: Number(parent.id),
                        order: Number(item.order_index || 0),
                        ancestors,
                      });
                    }}
                  >
                    {item.content_type === "text" &&
                      item.text_type === "link" && (
                        <Link2 size={15} aria-hidden="true" />
                      )}
                    {item.content_type === "text" &&
                      item.text_type === "prompt" && (
                        <Terminal size={15} aria-hidden="true" />
                      )}
                    {blockTitle(item)}
                  </button>
                  <button
                    type="button"
                    className="outline-toggle"
                    aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
                    aria-expanded={open}
                    onClick={(e) => {
                      e.preventDefault();
                      outline.setExpanded(key, !open);
                    }}
                  >
                    <ChevronRight size={17} aria-hidden="true" />
                  </button>
                </summary>
                <div className="order-controls">
                  <button
                    aria-label="Move up"
                    disabled={busy || index === 0}
                    onClick={() => void move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    aria-label="Move down"
                    disabled={busy || index === q.data.length - 1}
                    onClick={() => void move(index, 1)}
                  >
                    ↓
                  </button>
                </div>
                {open && (
                  <Branch
                    kind={d.kind}
                    data={item}
                    select={select}
                    ancestors={[...ancestors, key]}
                  />
                )}
              </details>
            );
          }}
        />
      )}
      {error !== undefined && <ErrorPanel error={error} />}
    </div>
  );
}
