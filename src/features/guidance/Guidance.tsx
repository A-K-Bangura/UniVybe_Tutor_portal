import { useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  entity,
  object,
  page,
  request,
  rows,
  str,
  type RecordData,
} from "../../shared/api/client";
import { Header, Loading, ErrorPanel, Modal } from "../../shared/ui/primitives";
import { GuidanceForm, Input } from "./Form";
import GuideForm from "./GuideForm";
import RoutingSummary from "./RoutingSummary";
import { adminPath, guidePath, key } from "./api";

function readableDate(value: unknown) {
  const raw = str(value);
  if (!raw) return "Not recorded";
  const date = new Date(raw);
  return Number.isNaN(date.getTime())
    ? raw
    : date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
}
function Details({
  value,
  proposal = false,
}: {
  value: RecordData;
  proposal?: boolean;
}) {
  return (
    <div className="guidance-detail-grid">
      {proposal && value.name != null && (
        <div>
          <h3>Proposed name</h3>
          <p>{str(value.name)}</p>
        </div>
      )}
      {value.whatsapp_number != null && (
        <div>
          <h3>WhatsApp contact</h3>
          <p className="guidance-contact-number">
            {str(value.whatsapp_number)}
          </p>
        </div>
      )}
      {!!value.description && (
        <div>
          <h3>Private reviewer note</h3>
          <p className="guidance-private-note">{str(value.description)}</p>
        </div>
      )}
      {value.categories != null && (
        <div>
          <h3>Question categories</h3>
          <ul className="guidance-detail-tags">
            {rows(value.categories).map((c) => (
              <li key={str(c.id)}>{str(c.name)}</li>
            ))}
          </ul>
        </div>
      )}
      {value.coverage != null && (
        <div className="guidance-detail-coverage">
          <h3>Coverage</h3>
          <ul>
            {rows(value.coverage).map((c, i) => (
              <li key={i}>
                {str(c.label)}
                {c.is_valid === false ? " (invalid place)" : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
export default function Guidance({
  admin = false,
  view = "guides",
}: {
  admin?: boolean;
  view?: string;
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<RecordData>();
  const [action, setAction] = useState<{ record: RecordData; name: string }>();
  const [message, setMessage] = useState("");
  const cache = useQueryClient();
  const path = admin ? `${adminPath}/${view}` : guidePath;
  const creating = id === "new";
  const q = useQuery({
    queryKey: ["guidance", path, id, params.toString()],
    enabled: !creating,
    queryFn: ({ signal }) =>
      request(
        `${path}${id ? `/${key(id)}` : view === "guides" || view === "inquiries" ? `?per_page=15&${params}` : ""}`,
        "GET",
        undefined,
        signal,
      ),
  });
  const summary = useQuery({
    queryKey: ["guidance", "summary", params.toString()],
    enabled: admin && view === "inquiries",
    queryFn: async ({ signal }) =>
      object(
        (
          await request(
            `${adminPath}/inquiries/summary?${params}`,
            "GET",
            undefined,
            signal,
          )
        ).data,
      ),
  });
  async function refresh() {
    await cache.invalidateQueries({ queryKey: ["guidance"] });
  }
  const data = object(q.data?.data);
  const guide = id && !creating && q.data ? entity(q.data, "guide") : {};
  const collection =
    q.data && !id && ["guides", "inquiries"].includes(view)
      ? page(q.data)
      : undefined;
  return (
    <>
      <Header
        title={
          view === "guides"
            ? admin
              ? "Guide review"
              : "My guidance contacts"
            : view === "inquiries"
              ? "Guidance routing history"
              : `Guidance ${view}`
        }
        subtitle="UniVybe provides contacts. WhatsApp conversations, messages and resolutions are not tracked."
      >
        <Link className="button" to="/guidance">
          My guides
        </Link>
        {!admin && (
          <Link className="button primary" to="/guidance/new">
            Submit a guide
          </Link>
        )}
        {admin && (
          <>
            {["guides", "categories", "settings", "inquiries"].map((v) => (
              <Link
                className={`button${view === v ? " primary" : ""}`}
                aria-current={view === v ? "page" : undefined}
                key={v}
                to={`/guidance-admin/${v}`}
              >
                {
                  {
                    guides: "Guide reviews",
                    categories: "Categories",
                    settings: "Contact settings",
                    inquiries: "Routing history",
                  }[v]
                }
              </Link>
            ))}
          </>
        )}
      </Header>
      {message && (
        <p className="guidance-status-notice" role="status">
          {message}
        </p>
      )}
      {creating ? (
        <GuideForm
          guide={{}}
          save={async (body) => {
            const response = await request(guidePath, "POST", body);
            setMessage(str(response.message));
            navigate(`/guidance/${key(entity(response, "guide").id)}`);
            await refresh();
          }}
        />
      ) : q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorPanel error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          {id && (
            <>
              <section className="panel guidance-detail-panel">
                <h2>{str(guide.name)}</h2>
                <div className="guidance-detail-status">
                  <span
                    className={`guidance-status-pill ${guide.approval_status === "approved" ? "is-positive" : ""}`}
                  >
                    Approval: {str(guide.approval_status)}
                  </span>
                  <span className="guidance-status-pill">
                    {guide.is_active ? "Active" : "Inactive"}
                  </span>
                  <span
                    className={`guidance-status-pill ${guide.is_matchable ? "is-positive" : ""}`}
                  >
                    {guide.is_matchable
                      ? "Available to students"
                      : "Not available to students"}
                  </span>
                  {guide.removed_at ? (
                    <span className="guidance-status-pill">Removed</span>
                  ) : null}
                </div>
                <Details value={guide} />
                {admin && (
                  <section className="guidance-detail-admin">
                    <h3>Review & activity</h3>
                    <dl>
                      {[
                        [
                          "Submitted by",
                          str(object(guide.submitted_by).name) || "Unknown",
                        ],
                        [
                          "Approved by",
                          str(object(guide.approved_by).name) ||
                            "Not yet approved",
                        ],
                        [
                          "Consent recorded",
                          readableDate(guide.consent_given_at),
                        ],
                        [
                          "Consent recorded by",
                          str(object(guide.consent_recorded_by).name) ||
                            "Unknown",
                        ],
                        [
                          "Last contact provided",
                          guide.last_assigned_at
                            ? readableDate(guide.last_assigned_at)
                            : "Never",
                        ],
                        [
                          "Contacts provided",
                          str(guide.inquiries_count) || "0",
                        ],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}
                {!!(
                  guide.rejection_reason || guide.changes_rejection_reason
                ) && (
                  <section className="guidance-review-feedback">
                    <h3>Reviewer feedback</h3>
                    <p>{str(guide.rejection_reason)}</p>
                    <p>{str(guide.changes_rejection_reason)}</p>
                  </section>
                )}
                {guide.has_pending_changes === true && (
                  <section className="guidance-proposal">
                    <h3>Proposed changes awaiting review</h3>
                    <Details value={object(guide.pending_changes)} proposal />
                  </section>
                )}
                {!guide.removed_at && (
                  <div className="actions guidance-detail-actions">
                    <button
                      className="primary"
                      onClick={() => setEditing(guide)}
                    >
                      Edit guide
                    </button>
                    {(admin || guide.approval_status !== "approved") && (
                      <button
                        className="danger"
                        onClick={() =>
                          setAction({ record: guide, name: "remove" })
                        }
                      >
                        {admin ? "Remove guide" : "Withdraw guide"}
                      </button>
                    )}
                    {admin && (
                      <>
                        {["pending", "rejected"].includes(
                          str(guide.approval_status),
                        ) && (
                          <button
                            onClick={() =>
                              setAction({ record: guide, name: "approve" })
                            }
                          >
                            Approve guide
                          </button>
                        )}
                        {guide.approval_status === "pending" && (
                          <button
                            onClick={() =>
                              setAction({ record: guide, name: "reject" })
                            }
                          >
                            Reject guide
                          </button>
                        )}
                        {guide.has_pending_changes === true && (
                          <>
                            <button
                              onClick={() =>
                                setAction({
                                  record: guide,
                                  name: "changes/approve",
                                })
                              }
                            >
                              Approve changes
                            </button>
                            <button
                              onClick={() =>
                                setAction({
                                  record: guide,
                                  name: "changes/reject",
                                })
                              }
                            >
                              Reject changes
                            </button>
                          </>
                        )}
                        <button
                          onClick={() =>
                            setAction({
                              record: guide,
                              name: guide.is_active ? "deactivate" : "activate",
                            })
                          }
                        >
                          {guide.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </section>
              {admin && (
                <section className="panel">
                  <h2>Audit trail</h2>
                  {rows(guide.events).map((event, i) => (
                    <p key={i}>
                      {str(event.at)} · {str(event.event)} ·{" "}
                      {str(object(event.by).name)} ·{" "}
                      {Object.entries(object(event.metadata))
                        .map(
                          ([k, v]) =>
                            `${k}: ${Array.isArray(v) ? v.join(", ") : str(v)}`,
                        )
                        .join(" · ")}
                    </p>
                  ))}
                </section>
              )}
            </>
          )}
          {collection && (
            <>
              <form
                key={params.toString()}
                className="panel form-grid"
                onSubmit={(e) => {
                  e.preventDefault();
                  const values = new FormData(e.currentTarget);
                  const next = new URLSearchParams();
                  for (const [k, v] of values) if (str(v)) next.set(k, str(v));
                  setParams(next);
                }}
              >
                {view === "guides" ? (
                  <>
                    <label>
                      Status
                      <select
                        name="status"
                        defaultValue={params.get("status") || ""}
                      >
                        <option value="">All</option>
                        {["pending", "approved", "rejected"].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    {admin && (
                      <>
                        <label>
                          Guide name
                          <input
                            name="q"
                            defaultValue={params.get("q") || ""}
                          />
                        </label>
                        {[
                          "is_active",
                          "needs_review",
                          "has_pending_changes",
                        ].map((name) => (
                          <label key={name}>
                            {name.replaceAll("_", " ")}
                            <select
                              name={name}
                              defaultValue={params.get(name) || ""}
                            >
                              <option value="">All</option>
                              <option value="1">Yes</option>
                              <option value="0">No</option>
                            </select>
                          </label>
                        ))}
                        <label>
                          Removed guides
                          <select
                            name="trashed"
                            defaultValue={params.get("trashed") || ""}
                          >
                            <option value="">Exclude removed</option>
                            <option value="with">Include removed</option>
                            <option value="only">Removed only</option>
                          </select>
                        </label>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <label>
                      Source
                      <select name="source">
                        <option value="">All</option>
                        <option>general</option>
                        <option>onboarding</option>
                      </select>
                    </label>
                    <label>
                      Contact destination
                      <select name="central">
                        <option value="">All</option>
                        <option value="1">Central contact</option>
                        <option value="0">Guide</option>
                      </select>
                    </label>
                    {["from", "to"].map((name) => (
                      <label key={name}>
                        {name}
                        <input
                          type="date"
                          name={name}
                          defaultValue={params.get(name) || ""}
                        />
                      </label>
                    ))}
                  </>
                )}
                {admin &&
                  (view === "guides"
                    ? ["category_id", "submitted_by"]
                    : ["guide_id", "student_id", "category_id", "university_id"]
                  ).map((name) => (
                    <label key={name}>
                      {name.replaceAll("_", " ")}
                      <input
                        name={name}
                        type="number"
                        min="1"
                        defaultValue={params.get(name) || ""}
                      />
                    </label>
                  ))}
                <div className="actions guidance-filter-actions">
                  <button className="primary" type="submit">
                    Apply filters
                  </button>
                  <button type="button" onClick={() => setParams({})}>
                    Clear filters
                  </button>
                </div>
              </form>
              {view === "inquiries" &&
                (summary.isError ? (
                  <ErrorPanel
                    error={summary.error}
                    retry={() => void summary.refetch()}
                  />
                ) : (
                  summary.data && <RoutingSummary data={summary.data} />
                ))}
              {view === "inquiries" && (
                <div className="guidance-routing-heading">
                  <h2>Routing history</h2>
                  <p>
                    {collection.total} contacts provided · Most recent first
                  </p>
                </div>
              )}
              {collection.items.map((r) => (
                <article className="panel" key={str(r.id)}>
                  {view === "guides" ? (
                    <>
                      <h2>
                        <Link
                          to={`${admin ? "/guidance-admin/guides" : "/guidance"}/${key(r.id)}`}
                        >
                          {str(r.name)}
                        </Link>
                      </h2>
                      <p>
                        {str(r.approval_status)} ·{" "}
                        {r.is_active ? "Active" : "Inactive"} ·{" "}
                        {r.is_matchable
                          ? "Available to students"
                          : "Not available"}
                        {r.has_pending_changes
                          ? " · Changes awaiting review"
                          : ""}
                        {r.removed_at ? " · Removed" : ""}
                      </p>
                      <p>{str(r.rejection_reason)}</p>
                    </>
                  ) : (
                    <>
                      <h2>{str(object(r.category).name)}</h2>
                      <p>
                        {str(r.routed_at)} ·{" "}
                        {str(object(r.student).name) ||
                          "Student name not provided"}{" "}
                        ·{" "}
                        {r.is_central_fallback
                          ? "Central UniVybe contact"
                          : str(object(r.guide).name)}
                        {object(r.guide).is_removed ? " (removed)" : ""}
                      </p>
                      <p>
                        {["university", "faculty", "department"]
                          .map((k) => str(object(r[k]).name))
                          .filter(Boolean)
                          .join(" > ")}{" "}
                        · {str(r.source)} · {str(r.match_tier)}
                      </p>
                    </>
                  )}
                </article>
              ))}
              {!collection.items.length &&
                (view === "inquiries" ? (
                  <section className="panel guidance-routing-empty">
                    <h3>No contacts provided yet</h3>
                    <p>
                      No routing records match these filters. Try a wider date
                      range or clear the filters.
                    </p>
                    <p>
                      New assignments will appear here when students receive a
                      contact.
                    </p>
                    <button onClick={() => setParams({})}>
                      Reset history filters
                    </button>
                  </section>
                ) : (
                  <p>No records match these filters.</p>
                ))}
              <div
                className={`actions${view === "inquiries" ? " guidance-routing-pagination" : ""}`}
              >
                <button
                  disabled={collection.current <= 1}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set("page", String(collection.current - 1));
                    setParams(next);
                  }}
                >
                  Previous
                </button>
                <span>
                  Page {collection.current} of {collection.last}
                </span>
                <button
                  disabled={collection.current >= collection.last}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set("page", String(collection.current + 1));
                    setParams(next);
                  }}
                >
                  Next
                </button>
              </div>
            </>
          )}
          {view === "categories" && (
            <>
              <button
                onClick={() =>
                  setEditing({
                    is_active: true,
                    sort_order: 0,
                    required_context: "none",
                  })
                }
              >
                Create category
              </button>
              {rows(data.categories).map((c) => (
                <article className="panel" key={str(c.id)}>
                  <h2>{str(c.name)}</h2>
                  <p>
                    {str(c.description)} · Required context:{" "}
                    {str(c.required_context)} ·{" "}
                    {c.is_active ? "Active" : "Inactive"} ·{" "}
                    {str(c.guides_count)} guides · {str(c.inquiries_count)}{" "}
                    contacts provided
                  </p>
                  <div className="actions">
                    <button onClick={() => setEditing(c)}>Edit category</button>
                    <button
                      disabled={
                        !!c.is_reserved ||
                        Number(c.guides_count) > 0 ||
                        Number(c.inquiries_count) > 0
                      }
                      onClick={() => setAction({ record: c, name: "remove" })}
                    >
                      Delete category
                    </button>
                  </div>
                  {c.is_reserved === true && (
                    <p>Built-in category: cannot be deactivated or deleted.</p>
                  )}
                </article>
              ))}
            </>
          )}
          {view === "settings" && (
            <>
              <p>
                {data.is_configured
                  ? "Central contact configured"
                  : "No central contact configured. Unmatched students cannot receive a fallback contact."}
              </p>
              <GuidanceForm
                key={str(object(data.settings).id)}
                initial={object(data.settings)}
                save={async (values) => {
                  const response = await request(path, "PUT", {
                    central_whatsapp: values.central_whatsapp,
                    note: values.note || null,
                  });
                  setMessage(
                    object(response.data).changed === false
                      ? "The central number is unchanged."
                      : "Central number updated.",
                  );
                  await refresh();
                }}
              >
                {(values) => (
                  <>
                    <Input
                      name="central_whatsapp"
                      title="Central WhatsApp number"
                      required
                      values={values}
                    />
                    <Input name="note" title="Note" values={values} />
                  </>
                )}
              </GuidanceForm>
              <h2>Contact history</h2>
              {rows(data.history).map((r, i) => (
                <p key={i}>
                  {str(r.central_whatsapp)} · {str(r.note)} ·{" "}
                  {str(r.changed_by)} · {str(r.created_at)}
                </p>
              ))}
            </>
          )}
        </>
      )}
      {editing && (
        <Modal
          open
          title={view === "categories" ? "Guidance category" : "Edit guide"}
          onClose={() => setEditing(undefined)}
        >
          {view === "categories" ? (
            <GuidanceForm
              initial={editing}
              save={async (values) => {
                const body: RecordData = {};
                for (const name of [
                  "name",
                  "slug",
                  "description",
                  "required_context",
                  "is_active",
                  "sort_order",
                ]) {
                  const value =
                    name === "sort_order"
                      ? Number(values[name] || 0)
                      : values[name];
                  if (name === "slug" && !value) continue;
                  if (!editing.id || value !== editing[name])
                    body[name] = value;
                }
                await request(
                  `${path}${editing.id ? `/${key(editing.id)}` : ""}`,
                  editing.id ? "PUT" : "POST",
                  body,
                );
                setEditing(undefined);
                await refresh();
              }}
            >
              {(values) => (
                <>
                  <Input
                    name="name"
                    title="Name"
                    required
                    maxLength={80}
                    values={values}
                  />
                  <Input
                    name="slug"
                    title="Slug"
                    maxLength={100}
                    values={values}
                  />
                  <Input
                    name="description"
                    title="Description"
                    maxLength={255}
                    values={values}
                  />
                  <label>
                    Required context
                    <select
                      name="required_context"
                      defaultValue={str(values.required_context)}
                    >
                      {["none", "university", "faculty", "department"].map(
                        (s) => (
                          <option key={s}>{s}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <Input
                    name="sort_order"
                    title="Display order"
                    type="number"
                    min={0}
                    max={65535}
                    step="1"
                    values={values}
                  />
                  <label>
                    <input
                      type="checkbox"
                      name="is_active"
                      disabled={!!editing.is_reserved}
                      defaultChecked={!!values.is_active}
                    />
                    Active
                  </label>
                </>
              )}
            </GuidanceForm>
          ) : (
            <GuideForm
              guide={editing}
              save={async (body) => {
                const response = await request(
                  `${guidePath}/${key(editing.id)}`,
                  "PUT",
                  body,
                );
                setMessage(str(response.message));
                setEditing(undefined);
                await refresh();
              }}
            />
          )}
        </Modal>
      )}
      {action && (
        <Modal
          open
          title={
            action.name === "remove"
              ? "Confirm removal"
              : action.name.replaceAll("/", " ")
          }
          onClose={() => setAction(undefined)}
        >
          <GuidanceForm
            initial={{}}
            button="Confirm action"
            save={async (values) => {
              await request(
                `${path}/${key(action.record.id)}${action.name === "remove" ? "" : `/${action.name}`}`,
                action.name === "remove" ? "DELETE" : "PUT",
                action.name === "remove" ? undefined : values,
              );
              setAction(undefined);
              setMessage("Action completed.");
              if (action.name === "remove" && id)
                navigate(admin ? "/guidance-admin/guides" : "/guidance");
              await refresh();
            }}
          >
            {(values) => (
              <>
                <p>
                  {action.name.replaceAll("/", " ")} {str(action.record.name)}?
                </p>
                {action.name !== "remove" && (
                  <Input
                    name={
                      action.name.endsWith("reject")
                        ? "reason"
                        : ["activate", "deactivate"].includes(action.name)
                          ? "note"
                          : "comment"
                    }
                    title={
                      action.name.endsWith("reject") ? "Reason" : "Review note"
                    }
                    required={action.name.endsWith("reject")}
                    maxLength={2000}
                    type="textarea"
                    values={values}
                  />
                )}
              </>
            )}
          </GuidanceForm>
        </Modal>
      )}
    </>
  );
}
