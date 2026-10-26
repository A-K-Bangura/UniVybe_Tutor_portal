import { Comments } from "../feed/Comments";
import { OpportunityPreview } from "../opportunities/Preview";
import { FeedPreview } from "../feed/Preview";
import { useState, useRef } from "react";
import type { PendingSequence } from "../resources/Attachments";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { detail, save } from "./service";
import { useSession } from "../../shared/auth/session";
import {
  Header,
  Loading,
  ErrorPanel,
  DataView,
  Badge,
  Modal,
} from "../../shared/ui/primitives";
import { SchemaForm, type Field } from "../../shared/forms/SchemaForm";
import {
  str,
  object,
  rows,
  request,
  type RecordData,
} from "../../shared/api/client";
import { courseFields, f } from "../courses/fields";
import { resourceFields } from "../resources/config";
import { opportunityFields } from "../opportunities/config";
import { feedFields } from "../feed/config";
import { userFields } from "../users/config";
import { institutionFields } from "../institutions/config";
import { roadmapFields } from "../roadmaps/config";
import { uploadResource, uploadMedia } from "../../shared/uploads/workflows";
import { Decision } from "../reviews/Decision";
import { CourseBuilder } from "../course-builder/Builder";
import { RoadmapSequence } from "../roadmaps/Sequence";
import { CoursePicker } from "../roadmaps/CoursePicker";
import { registryFields } from "../academic-modules/config";
import { moduleDefaults, registryPayload } from "../academic-modules/api";
const fieldMap: Record<string, Field[]> = {
  courses: courseFields,
  resources: resourceFields,
  opportunities: opportunityFields,
  feed: feedFields,
  users: userFields,
  roadmaps: roadmapFields,
  "academic-modules": registryFields,
};
export default function Editor({ kind }: { kind: string }) {
  const { id } = useParams(),
    isNew = !id,
    role = useSession((s) => s.user!.role.name),
    navigate = useNavigate(),
    cache = useQueryClient();
  const q = useQuery({
    queryKey: ["detail", kind, id, role],
    queryFn: ({ signal }) => detail(kind, role, id!, signal),
    enabled: !!id,
  });
  const vocab = useQuery({
    queryKey: ["vocab", kind],
    queryFn: async ({ signal }) =>
      object(
        (await request(`${kind}/types`, "GET", undefined, signal, true)).data,
      ),
    enabled: ["resources", "opportunities"].includes(kind),
  });
  const [action, setAction] = useState<string>(),
    [file, setFile] = useState<File>(),
    [stage, setStage] = useState(""),
    [source, setSource] = useState("external"),
    [cover, setCover] = useState<RecordData | undefined>(),
    [uploadError, setUploadError] = useState<unknown>(),
    [controller, setController] = useState<AbortController>(),
    [clearedDeadline, setClearedDeadline] = useState(false),
    [actionRows, setActionRows] = useState<RecordData[] | undefined>(),
    [preview, setPreview] = useState(false);
  const [sequenceDirty, setSequenceDirty] = useState(false);
  const [initialCourses, setInitialCourses] = useState<RecordData[]>([]);
  const sequence = useRef<PendingSequence>(null);
  if (id && q.isPending) return <Loading />;
  if (q.isError)
    return <ErrorPanel error={q.error} retry={() => void q.refetch()} />;
  const data = q.data || {},
    permissions = object(data.permissions);
  const locked =
    !isNew &&
    (kind === "users" ||
      (["resources", "opportunities"].includes(kind) &&
        permissions.can_edit !== true) ||
      (kind === "feed" &&
        role !== "admin" &&
        !["pending", "rejected"].includes(str(data.status))));
  let fields = (fieldMap[kind] || institutionFields(kind)).map((field) => ({
    ...field,
  }));
  if (kind === "academic-modules" && Number(data.courses_count) > 0)
    fields = fields.filter((field) =>
      ["code", "title", "is_active"].includes(field.name),
    );
  if (kind === "resources" || kind === "opportunities") {
    const field = fields.find(
      (x) =>
        x.name ===
        (kind === "resources" ? "resource_type" : "opportunity_type"),
    );
    if (field)
      field.options = rows(
        vocab.data?.[
          kind === "resources" ? "resource_types" : "opportunity_types"
        ],
      ).map((x) => ({ value: str(x.value), label: str(x.label) }));
    if (vocab.isPending) return <Loading />;
    if (vocab.isError)
      return (
        <ErrorPanel error={vocab.error} retry={() => void vocab.refetch()} />
      );
  }
  if (
    kind === "resources" &&
    (isNew ? source === "external" : data.source_type === "external")
  )
    fields = [
      ...fields,
      f("external_url", "url", true),
      {
        ...f("link_type", "select"),
        options: rows(vocab.data?.link_types).map((x) => ({
          value: str(x.value),
          label: str(x.label),
        })),
      },
    ];
  if (kind === "opportunities")
    fields.push({
      ...f("actions", "json"),
      help: "Action link rows are edited below.",
    });
  const initial = {
    ...data,
    ...object(data.academic_context),
    content: data.content_html || data.content_text || data.content || "",
    application_deadline: str(data.application_deadline).slice(0, 10),
    ...(kind === "academic-modules" ? moduleDefaults(data) : {}),
  };
  if (kind === "courses" && !isNew)
    return (
      <CourseBuilder
        course={data}
        id={id!}
        onAction={setAction}
        action={action}
        closeAction={() => setAction(undefined)}
      />
    );
  return (
    <>
      <Header
        title={
          isNew
            ? `Create ${kind === "academic-modules" ? "academic module" : kind === "feed" ? "post" : kind.replace(/ies$/, "y").replace(/s$/, "")}`
            : str(data.title || data.name || data.full_name || data.email)
        }
        subtitle={
          kind === "opportunities"
            ? "Organization, contact information, and action links are public."
            : kind === "resources"
              ? "Resource kind and file format are separate. Rejected edits automatically return for review."
              : kind === "academic-modules"
                ? "Official module registry. Deactivate modules to retire them; courses keep their existing assignments."
                : undefined
        }
      >
        <Badge value={data.status} />
        {kind === "opportunities" && !isNew && (
          <button onClick={() => setPreview(true)}>Preview opportunity</button>
        )}
        {!isNew && (
          <>
            {role === "admin" &&
              ["users", "resources", "opportunities", "feed"].includes(kind) &&
              ["pending", "pending_approval", "rejected"].includes(
                str(data.status),
              ) && (
                <>
                  <button onClick={() => setAction("approve")}>Approve</button>
                  {str(data.status) !== "rejected" && (
                    <button onClick={() => setAction("reject")}>Reject</button>
                  )}
                </>
              )}
            {kind === "users" && role === "admin" && (
              <button onClick={() => setAction("suspend")}>Suspend</button>
            )}
            {kind === "feed" && role === "admin" && (
              <button onClick={() => setAction("hide")}>Hide</button>
            )}
            {kind === "opportunities" && permissions.can_submit === true && (
              <button
                className="primary"
                onClick={async () => {
                  try {
                    await request(`tutor/opportunities/${id}/submit`, "POST");
                    await cache.invalidateQueries();
                  } catch (e) {
                    setUploadError(e);
                  }
                }}
              >
                {role === "admin"
                  ? "Publish own opportunity"
                  : data.status === "rejected"
                    ? "Resubmit for approval"
                    : "Submit for approval"}
              </button>
            )}
            {kind === "opportunities" &&
              role === "admin" &&
              [
                ["publish", ["draft", "unpublished"]],
                ["unpublish", ["published", "closed"]],
                ["close", ["published"]],
                ["reopen", ["closed", "published"]],
              ]
                .filter(([, states]) =>
                  (states as string[]).includes(str(data.status)),
                )
                .map(([a]) => (
                  <button key={str(a)} onClick={() => setAction(str(a))}>
                    {str(a)}
                  </button>
                ))}
            {(role === "admin" ||
              permissions.can_delete === true ||
              (kind === "feed" && !locked)) && (
              <button
                className="danger-text"
                onClick={() => setAction("delete")}
              >
                Delete
              </button>
            )}
          </>
        )}
      </Header>
      {kind === "academic-modules" && !isNew && (
        <section className="panel">
          <p>{str(data.courses_count)} courses use this module.</p>
          <DataView
            value={{
              scope: data.scope,
              university: data.university,
              faculty: data.faculty,
              department: data.department,
            }}
          />
          {Number(data.courses_count) > 0 && (
            <p className="notice">
              The academic location and scope are locked while courses use this
              module. Its code, title and active status can still change.
            </p>
          )}
        </section>
      )}
      {["faculties", "departments"].includes(kind) && !isNew && (
        <p className="notice">
          Academic modules can prevent moving or deleting this{" "}
          {kind === "faculties" ? "faculty" : "department"}. The server checks
          its dependencies before saving.
        </p>
      )}
      {data.rejection_reason != null && (
        <div className="feedback">
          <strong>Changes requested</strong>
          <p>{str(data.rejection_reason)}</p>
        </div>
      )}
      {uploadError !== undefined && <ErrorPanel error={uploadError} />}
      {locked ? (
        <div className="panel">
          <p className="notice">
            This record is locked for editing under its current permissions.
          </p>
          <DataView value={data} />
          {kind === "feed" && <FeedPreview data={data} />}
        </div>
      ) : (
        <div className="panel">
          {kind === "resources" && (
            <div className="upload-panel">
              {isNew && (
                <label>
                  Resource source{" "}
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                  >
                    <option value="external">External link</option>
                    <option value="file">Uploaded file</option>
                  </select>
                </label>
              )}
              {(isNew ? source === "file" : data.source_type === "file") && (
                <>
                  <label className="field">
                    {isNew
                      ? "Choose file"
                      : "Replace file (course links are retained)"}
                    <input
                      type="file"
                      accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => setFile(e.target.files?.[0])}
                    />
                  </label>
                  {!isNew && file && (
                    <button
                      onClick={async () => {
                        const c = new AbortController();
                        setController(c);
                        try {
                          const token = await uploadResource(
                            file,
                            setStage,
                            c.signal,
                          );
                          await request(`tutor/resources/${id}/file`, "POST", {
                            upload_token: token,
                          });
                          setStage("Replacement confirmed");
                          setFile(undefined);
                          await cache.invalidateQueries();
                        } catch (e) {
                          setUploadError(e);
                          setStage(
                            "Replacement failed; check current version before retrying",
                          );
                        } finally {
                          setController(undefined);
                        }
                      }}
                    >
                      Upload replacement
                    </button>
                  )}
                </>
              )}
              {stage && <p role="status">{stage}</p>}
              {controller && (
                <button onClick={() => controller.abort()}>
                  Cancel transfer
                </button>
              )}
            </div>
          )}
          {kind === "opportunities" && (
            <>
              <Actions
                initial={rows(data.actions)}
                onChange={setActionRows}
                types={rows(vocab.data?.action_types)}
              />
              <label className="field">
                Cover image URL (HTTPS)
                <input
                  type="url"
                  defaultValue={str(object(data.cover_image).url)}
                  onChange={(e) =>
                    setCover(
                      e.target.value
                        ? { source: "external", url: e.target.value }
                        : (null as unknown as RecordData),
                    )
                  }
                />
              </label>
              <label className="field">
                Or upload a cover
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={async (e) => {
                    const chosen = e.target.files?.[0];
                    if (!chosen) return;
                    try {
                      const uploaded = await uploadMedia(
                        chosen,
                        "thumbnail",
                        setStage,
                        new AbortController().signal,
                      );
                      setCover({
                        source: "cloudinary",
                        public_id: uploaded.public_id,
                      });
                    } catch (error) {
                      setUploadError(error);
                    }
                  }}
                />
              </label>
              <button onClick={() => setCover(null as unknown as RecordData)}>
                Remove cover
              </button>
              <label className="field">
                <span>
                  <input
                    type="checkbox"
                    checked={clearedDeadline}
                    onChange={(e) => setClearedDeadline(e.target.checked)}
                  />{" "}
                  Remove application deadline
                </span>
              </label>
              <p role="status">{stage}</p>
            </>
          )}
          <SchemaForm
            preview={
              kind === "feed"
                ? (values) => <FeedPreview data={values} />
                : undefined
            }
            externalDirty={
              actionRows !== undefined ||
              cover !== undefined ||
              clearedDeadline ||
              sequenceDirty ||
              initialCourses.length > 0 ||
              !!file
            }
            key={id || "new"}
            onDiscard={() => {
              sequence.current?.discard();
              setInitialCourses([]);
            }}
            fields={fields.filter(
              (x) => !(kind === "opportunities" && x.name === "actions"),
            )}
            initial={initial}
            button={
              isNew
                ? kind === "opportunities"
                  ? "Save draft"
                  : `Create ${kind === "academic-modules" ? "academic module" : kind.replace(/s$/, "")}`
                : "Save changes"
            }
            validate={(values) =>
              kind === "academic-modules" &&
              values.scope === "department" &&
              !values.department_id
                ? "Choose a department for a department module."
                : kind === "courses" &&
                    values.suggested_is_paid === true &&
                    !(Number(values.suggested_price) > 0)
                  ? "A paid suggestion requires a positive price."
                  : undefined
            }
            submit={async (values) => {
              if (kind === "roadmaps" && isNew)
                values.courses = initialCourses.map((course) =>
                  Number(course.id),
                );
              if (kind === "resources" && isNew) {
                values.source_type = source;
                if (source === "file") {
                  if (!file) throw new Error("Choose a file first.");
                  const c = new AbortController();
                  setController(c);
                  try {
                    values.upload_token = await uploadResource(
                      file,
                      setStage,
                      c.signal,
                    );
                  } finally {
                    setController(undefined);
                  }
                }
              }
              if (kind === "opportunities") {
                if (isNew || actionRows !== undefined)
                  values.actions = (actionRows || []).map((a) => ({
                    type: a.type,
                    label: a.label,
                    url: a.url,
                    is_primary: a.is_primary,
                  }));
                if (cover !== undefined) values.cover_image = cover;
                if (clearedDeadline) values.application_deadline = null;
                else if (
                  !isNew &&
                  values.application_deadline === initial.application_deadline
                )
                  delete values.application_deadline;
              }
              const result = object(
                await save(
                  kind,
                  kind === "academic-modules"
                    ? registryPayload(values, isNew ? undefined : data)
                    : values,
                  id,
                ),
              );
              setInitialCourses([]);
              if (kind === "roadmaps") await sequence.current?.save();
              setStage("Saved and confirmed");
              setActionRows(undefined);
              setCover(undefined);
              setClearedDeadline(false);
              setFile(undefined);
              await cache.invalidateQueries();
              if (isNew && result.id)
                navigate(`/${kind}/${str(result.uuid || result.id)}`);
            }}
          />
        </div>
      )}
      {kind === "roadmaps" && !isNew && (
        <RoadmapSequence
          id={id!}
          data={data}
          onDirty={setSequenceDirty}
          saveRef={sequence}
        />
      )}{" "}
      {kind === "roadmaps" && isNew && (
        <div className="panel">
          <CoursePicker
            selected={initialCourses}
            onChange={setInitialCourses}
          />
        </div>
      )}
      {kind === "feed" && !isNew && role === "admin" && (
        <Comments comments={rows(data.comments)} />
      )}{" "}
      {kind === "feed" && !isNew && <FeedStats id={id!} />}{" "}
      {rows(data.events).length > 0 && (
        <div className="panel">
          <h2>History</h2>
          <DataView value={data.events} />
        </div>
      )}
      {action && (
        <Decision
          kind={kind}
          id={id!}
          action={action}
          snapshot={data}
          creator={role !== "admin"}
          onDeleted={() => navigate(`/${kind}`)}
          onClose={() => {
            setAction(undefined);
          }}
        />
      )}
      {kind === "opportunities" && (
        <Modal
          title="Opportunity preview"
          open={preview}
          onClose={() => setPreview(false)}
        >
          <OpportunityPreview data={data} />
        </Modal>
      )}
    </>
  );
}
function Actions({
  initial,
  onChange,
  types,
}: {
  initial: RecordData[];
  onChange: (a: RecordData[]) => void;
  types: RecordData[];
}) {
  const [actions, setActions] = useState(initial);
  const update = (next: RecordData[]) => {
    setActions(next);
    onChange(next);
  };
  return (
    <div className="form-section">
      <h2>External action links</h2>
      <p>
        One primary action. Up to 10 links. UniVybe does not process
        applications.
      </p>
      {actions.map((a, i) => (
        <div className="action-row" key={i}>
          <input
            type="radio"
            aria-label={`Primary action ${i + 1}`}
            checked={a.is_primary === true}
            onChange={() =>
              update(actions.map((x, j) => ({ ...x, is_primary: i === j })))
            }
          />
          <select
            aria-label={`Action type ${i + 1}`}
            value={str(a.type)}
            onChange={(e) =>
              update(
                actions.map((x, j) =>
                  i === j ? { ...x, type: e.target.value } : x,
                ),
              )
            }
          >
            <option value="">Custom</option>
            {types.map((t) => (
              <option value={str(t.value)} key={str(t.value)}>
                {str(t.label)}
              </option>
            ))}
          </select>
          <input
            aria-label={`Action label ${i + 1}`}
            placeholder="Label"
            value={str(a.label)}
            onChange={(e) =>
              update(
                actions.map((x, j) =>
                  i === j ? { ...x, label: e.target.value } : x,
                ),
              )
            }
          />
          <input
            aria-label={`Action URL ${i + 1}`}
            placeholder="https://…"
            value={str(a.url)}
            onChange={(e) =>
              update(
                actions.map((x, j) =>
                  i === j ? { ...x, url: e.target.value } : x,
                ),
              )
            }
          />
          <button onClick={() => update(actions.filter((_, j) => i !== j))}>
            Remove
          </button>
        </div>
      ))}
      <button
        disabled={actions.length >= 10}
        onClick={() =>
          update([
            ...actions,
            {
              type: "learn_more",
              label: "Learn more",
              url: "",
              is_primary: actions.length === 0,
            },
          ])
        }
      >
        Add action link
      </button>
    </div>
  );
}
function FeedStats({ id }: { id: string }) {
  const q = useQuery({
    queryKey: ["post-analytics", id],
    queryFn: async ({ signal }) =>
      object(
        (await request(`tutor/feed/${id}/analytics`, "GET", undefined, signal))
          .data,
      ).analytics,
  });
  return (
    <div className="panel">
      <h2>Post statistics</h2>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorPanel error={q.error} />
      ) : (
        <DataView value={q.data} />
      )}
    </div>
  );
}
