import { useState, useRef } from "react";
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
import { SchemaForm } from "../../shared/forms/SchemaForm";
import {
  contentFields,
  courseFields,
  validateContent,
} from "../courses/fields";
import { Decision } from "../reviews/Decision";
import { useSession } from "../../shared/auth/session";
import { save } from "../catalog/service";
import { ContentPreview, Block } from "./Preview";
import { Attachments, type PendingSequence } from "../resources/Attachments";
interface Node {
  kind: string;
  data: RecordData;
  parentId: number;
  order: number;
}
const keys: Record<string, string> = {
  modules: "module",
  lessons: "lesson",
  "mini-lessons": "mini_lesson",
  "mini-lesson-blocks": "block",
  quizzes: "quiz",
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
      <div className="builder">
        <aside className="course-outline panel">
          <h2>Course outline</h2>
          <button
            className="outline-node"
            onClick={() =>
              select({ kind: "courses", data: course, parentId: 0, order: 0 })
            }
          >
            Course details
          </button>
          <Branch kind="courses" data={course} select={select} />
        </aside>
        <div className="panel editor-panel">
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
          <SchemaForm
            preview={
              node.kind === "mini-lesson-blocks"
                ? (values) => <Block data={values} />
                : undefined
            }
            key={`${node.kind}-${str(node.data.id) || "new"}-${node.parentId}`}
            fields={
              node.kind === "courses" ? courseFields : contentFields[node.kind]
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
            submit={async (values) => {
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
            }}
          />
          {node.kind === "courses" && (
            <Attachments
              id={id}
              onDirty={setAttachmentsDirty}
              saveRef={attachments}
            />
          )}
        </div>
      </div>
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
}: {
  kind: string;
  data: RecordData;
  select: (n: Node) => void;
}) {
  return (
    <>
      {(children[kind] || []).map((child) => (
        <Children
          key={child.kind}
          parent={data}
          descriptor={child}
          select={select}
        />
      ))}
    </>
  );
}
function Children({
  parent,
  descriptor: d,
  select,
}: {
  parent: RecordData;
  descriptor: { kind: string; path: string; key: string };
  select: (n: Node) => void;
}) {
  const [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [expanded, setExpanded] = useState<string[]>([]),
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
        <strong>{d.kind.replaceAll("-", " ")}</strong>
        <button
          disabled={busy || q.isPending || q.isError}
          onClick={() =>
            select({
              kind: d.kind,
              data: {},
              parentId: Number(parent.id),
              order: q.data?.length || 0,
            })
          }
        >
          Add
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
          render={(item, index) => (
            <details key={str(item.id)} open={expanded.includes(str(item.id))}>
              <summary>
                <button
                  className="outline-node"
                  onClick={(e) => {
                    e.preventDefault();
                    select({
                      kind: d.kind,
                      data: item,
                      parentId: Number(parent.id),
                      order: Number(item.order_index || 0),
                    });
                  }}
                >
                  {str(item.title || item.question) ||
                    `${str(item.content_type)} block`}
                </button>
                <button
                  type="button"
                  aria-label={`Expand ${str(item.title || item.question) || "content item"}`}
                  aria-expanded={expanded.includes(str(item.id))}
                  onClick={(e) => {
                    e.preventDefault();
                    setExpanded((previous) =>
                      previous.includes(str(item.id))
                        ? previous.filter((x) => x !== str(item.id))
                        : [...previous, str(item.id)],
                    );
                  }}
                >
                  ⌄
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
              {expanded.includes(str(item.id)) && (
                <Branch kind={d.kind} data={item} select={select} />
              )}
            </details>
          )}
        />
      )}
      {error !== undefined && <ErrorPanel error={error} />}
    </div>
  );
}
