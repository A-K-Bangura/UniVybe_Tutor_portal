import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  ArrowUpRight,
  Search,
  BookOpen,
  Files,
  Briefcase,
  MessageSquare,
} from "lucide-react";
import { list } from "./service";
import { useSession } from "../../shared/auth/session";
import { str, object } from "../../shared/api/client";
import {
  Header,
  Badge,
  Loading,
  ErrorPanel,
  label,
} from "../../shared/ui/primitives";
import { Decision } from "../reviews/Decision";
import { contentLevelOptions, levelLabel } from "../courses/levels";
import { AcademicModulePicker } from "../academic-modules/Picker";
import { AcademicContextFilters } from "../academic-modules/Filters";
import { AcademicModuleSummary } from "../academic-modules/Summary";
const statuses: Record<string, string[]> = {
  courses: ["draft", "pending_approval", "published", "rejected"],
  resources: ["pending_approval", "approved", "rejected"],
  opportunities: [
    "draft",
    "pending_approval",
    "rejected",
    "published",
    "closed",
    "unpublished",
  ],
  feed: ["pending", "approved", "rejected", "hidden"],
  users: ["pending", "approved", "active", "rejected", "suspended"],
  roadmaps: ["draft", "published", "archived"],
};
const icons: Record<string, typeof BookOpen> = {
  courses: BookOpen,
  resources: Files,
  opportunities: Briefcase,
  feed: MessageSquare,
};
const pendingStatuses: Record<string, string> = {
  courses: "pending_approval",
  resources: "pending_approval",
  opportunities: "pending_approval",
  feed: "pending",
  users: "pending",
};
export default function Collection({
  kind,
  review = false,
}: {
  kind: string;
  review?: boolean;
}) {
  const role = useSession((s) => s.user!.role.name),
    [params, setParams] = useSearchParams(),
    [selection, setSelection] = useState<number[]>([]),
    [bulk, setBulk] = useState<string>();
  const p = new URLSearchParams(params);
  const people = kind === "users" && role === "admin";
  const userType =
    params.get("user_type") === "student" ? "student" : "creation_user";
  if (people) p.set("user_type", userType);
  const status =
    params.get("status") ??
    (role === "admin" ? pendingStatuses[kind] || "" : "");
  if (status) p.set("status", status);
  else p.delete("status");
  p.set("per_page", "15");
  const hasFilters = [...p].some(
    ([key, value]) =>
      !["page", "per_page", "user_type"].includes(key) && !!value,
  );
  const q = useQuery({
    queryKey: ["collection", kind, role, p.toString()],
    queryFn: ({ signal }) => list(kind, role, p, signal),
  });
  const set = (key: string, value: string) => {
    // A preceding navigation may have updated the URL before React commits it.
    const next = new URLSearchParams(window.location.search);
    if (value || key === "status") next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };
  const Icon = icons[kind] || Files;
  const setMany = (changes: Record<string, string>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    setParams(next);
  };
  const academicFilters =
    kind === "academic-modules" || (kind === "courses" && role === "admin");
  return (
    <>
      <Header
        title={
          kind === "academic-modules"
            ? "Academic modules"
            : review
              ? `Review ${kind}`
              : people
                ? "People"
                : label(kind)
        }
        subtitle={
          kind === "academic-modules"
            ? "Official university modules. Deactivate a module to retire it without changing courses."
            : review
              ? "Read the full record before making a decision."
              : people
                ? "Manage creator accounts and students separately."
                : "Your work, in one place. Create, refine, and keep things moving."
        }
      >
        {!review && (!people || userType === "creation_user") && (
          <Link className="button primary" to={`/${kind}/new`}>
            <Plus size={17} /> Create{" "}
            {kind === "academic-modules"
              ? "academic module"
              : kind === "feed"
                ? "post"
                : kind.replace(/ies$/, "y").replace(/s$/, "")}
          </Link>
        )}
      </Header>
      {people && (
        <div className="tabs" role="tablist" aria-label="People account type">
          {[
            { value: "creation_user", title: "Creator users" },
            { value: "student", title: "Students" },
          ].map((tab) => (
            <button
              key={tab.value}
              id={`people-tab-${tab.value}`}
              role="tab"
              aria-selected={userType === tab.value}
              aria-controls="people-results"
              tabIndex={userType === tab.value ? 0 : -1}
              className={userType === tab.value ? "selected" : undefined}
              onClick={() => set("user_type", tab.value)}
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const target =
                  event.key === "Home"
                    ? "creation_user"
                    : event.key === "End"
                      ? "student"
                      : tab.value === "student"
                        ? "creation_user"
                        : "student";
                document.getElementById(`people-tab-${target}`)?.focus();
                set("user_type", target);
              }}
            >
              {tab.title}
            </button>
          ))}
        </div>
      )}
      <div
        id={people ? "people-results" : undefined}
        role={people ? "tabpanel" : undefined}
        aria-labelledby={people ? `people-tab-${userType}` : undefined}
      >
        <div className="toolbar">
          <div className="search-input">
            <Search size={18} />
            <input
              aria-label={`Search ${kind}`}
              placeholder={
                kind === "courses"
                  ? "Course title, module code or module name…"
                  : kind === "academic-modules"
                    ? "Module code or title…"
                    : `Search ${kind}…`
              }
              value={params.get("search") || ""}
              onChange={(e) => set("search", e.target.value)}
            />
          </div>
          {statuses[kind] && (
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => set("status", e.target.value)}
            >
              <option value="">All statuses</option>
              {statuses[kind].map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() =>
              setParams({
                ...(statuses[kind] ? { status: "" } : {}),
                ...(people ? { user_type: userType } : {}),
              })
            }
          >
            Clear filters
          </button>
          {role === "admin" && ["courses", "roadmaps"].includes(kind) && (
            <select
              aria-label="Filter by level"
              value={params.get("level") || ""}
              onChange={(e) => set("level", e.target.value)}
            >
              <option value="">Any level</option>
              {contentLevelOptions.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
          {kind === "academic-modules" && (
            <>
              <select
                aria-label="Module scope filter"
                value={params.get("scope") || ""}
                onChange={(event) => set("scope", event.target.value)}
              >
                <option value="">All scopes</option>
                <option value="faculty">Faculty</option>
                <option value="department">Department</option>
              </select>
              <select
                aria-label="Module active filter"
                value={params.get("is_active") || ""}
                onChange={(event) => set("is_active", event.target.value)}
              >
                <option value="">Active and retired</option>
                <option value="1">Active</option>
                <option value="0">Retired</option>
              </select>
            </>
          )}
        </div>
        {academicFilters && (
          <AcademicContextFilters
            values={Object.fromEntries(params)}
            onChange={setMany}
          />
        )}
        {kind === "courses" && role === "admin" && (
          <div className="panel">
            <label htmlFor="course-module-filter">Academic module filter</label>
            <AcademicModulePicker
              key={`${params.get("university_id")}:${params.get("faculty_id")}:${params.get("department_id")}`}
              id="course-module-filter"
              ariaLabel="Academic module filter"
              admin
              university={params.get("university_id") || ""}
              faculty={params.get("faculty_id") || ""}
              department={params.get("department_id") || ""}
              value={params.get("academic_module_id") || ""}
              onChange={(value) => set("academic_module_id", value)}
            />
          </div>
        )}
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorPanel error={q.error} retry={() => void q.refetch()} />
        ) : (
          <>
            {!q.data.items.length ? (
              <div className="empty">
                <Icon size={36} />
                <h2>{hasFilters ? "No matching records" : "A fresh start"}</h2>
                <p>
                  {hasFilters
                    ? "Try another search or clear your filters."
                    : `Your ${kind} will appear here when they are created.`}
                </p>
              </div>
            ) : role === "admin" ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {kind === "feed" && <th>Select</th>}
                      <th>
                        {["users"].includes(kind) ? "Person" : "Title / name"}
                      </th>
                      <th>Status</th>
                      <th>Context</th>
                      <th>Updated</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.items.map((item) => {
                      const id = str(item.uuid || item.id);
                      return (
                        <tr key={id}>
                          {kind === "feed" && (
                            <td>
                              <input
                                aria-label={`Select ${str(item.title)}`}
                                type="checkbox"
                                checked={selection.includes(Number(item.id))}
                                onChange={(e) =>
                                  setSelection(
                                    e.target.checked
                                      ? [...selection, Number(item.id)]
                                      : selection.filter(
                                          (x) => x !== Number(item.id),
                                        ),
                                  )
                                }
                              />
                            </td>
                          )}
                          <td>
                            <Link
                              className="entity-title"
                              to={`/${kind}/${id}`}
                            >
                              {str(
                                (kind === "academic-modules"
                                  ? item.label
                                  : undefined) ||
                                  item.title ||
                                  item.name ||
                                  item.full_name ||
                                  item.email,
                              ) || "Untitled"}
                            </Link>
                            <small>
                              {str(item.short_description || item.email)}
                            </small>
                            {kind === "courses" && (
                              <AcademicModuleSummary
                                value={item.academic_module}
                              />
                            )}
                          </td>
                          <td>
                            <Badge
                              value={
                                ((kind === "academic-modules"
                                  ? item.is_active
                                    ? "active"
                                    : "inactive"
                                  : undefined) ||
                                  item.status) ??
                                (item.is_active === true ? "active" : undefined)
                              }
                            />
                          </td>
                          <td>
                            {["courses", "roadmaps"].includes(kind) && (
                              <Badge value={levelLabel(item.level)} />
                            )}
                            {kind === "academic-modules" ? (
                              <>
                                <p>
                                  {str(item.scope)} ·{" "}
                                  {str(object(item.university).name)} ·{" "}
                                  {str(object(item.faculty).name)}
                                  {item.department
                                    ? ` · ${str(object(item.department).name)}`
                                    : ""}
                                </p>
                                <p>{str(item.courses_count)} courses</p>
                              </>
                            ) : (
                              str(
                                object(item.creator).full_name ||
                                  object(item.university).name ||
                                  item.resource_type ||
                                  item.opportunity_type ||
                                  item.type,
                              ) || "—"
                            )}
                          </td>
                          <td>
                            {str(item.updated_at || item.created_at).slice(
                              0,
                              10,
                            ) || "—"}
                          </td>
                          <td>
                            <Link
                              to={`/${kind}/${id}`}
                              aria-label="Open record"
                            >
                              <ArrowUpRight size={18} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card-grid">
                {q.data.items.map((item) => (
                  <Link
                    className="content-card"
                    key={str(item.id)}
                    to={`/${kind}/${str(item.uuid || item.id)}`}
                  >
                    <div className={`card-cover ${kind}`}>
                      {str(
                        item.thumbnail_url || object(item.cover_image).url,
                      ) ? (
                        <img
                          src={str(
                            item.thumbnail_url || object(item.cover_image).url,
                          )}
                          alt=""
                        />
                      ) : (
                        <>
                          <Icon size={30} />
                          <span>{str(item.title).slice(0, 1)}</span>
                        </>
                      )}
                    </div>
                    <div className="card-body">
                      <div className="card-meta">
                        <span>
                          {str(
                            item.resource_type ||
                              item.opportunity_type ||
                              item.type,
                          ) || label(kind)}
                        </span>
                        <Badge value={item.status} />
                        {["courses", "roadmaps"].includes(kind) && (
                          <Badge value={levelLabel(item.level)} />
                        )}
                      </div>
                      <h2>{str(item.title) || "Untitled"}</h2>
                      {kind === "courses" && (
                        <AcademicModuleSummary value={item.academic_module} />
                      )}
                      <p>
                        {str(
                          item.short_description ||
                            item.description ||
                            item.content_text,
                        ).slice(0, 120)}
                      </p>
                      <div className="card-foot">
                        <span>
                          {str(item.updated_at || item.created_at).slice(0, 10)}
                        </span>
                        <ArrowUpRight size={18} />
                      </div>
                      {item.rejection_reason != null && (
                        <p className="field-error">
                          {str(item.rejection_reason)}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <div className="pagination">
              <span>
                {q.data.total} records · Page {q.data.current} of {q.data.last}
              </span>
              <div className="actions">
                <button
                  disabled={q.data.current <= 1}
                  onClick={() => set("page", String(q.data.current - 1))}
                >
                  Previous
                </button>
                <button
                  disabled={q.data.current >= q.data.last}
                  onClick={() => set("page", String(q.data.current + 1))}
                >
                  Next
                </button>
              </div>
            </div>
            {kind === "feed" && role === "admin" && selection.length > 0 && (
              <div className="save-bar">
                <span>{selection.length} selected</span>
                <button onClick={() => setBulk("bulk-approve")}>
                  Approve selected
                </button>
                <button onClick={() => setBulk("bulk-reject")}>
                  Reject selected
                </button>
              </div>
            )}
          </>
        )}
        {bulk && (
          <Decision
            kind="feed"
            id=""
            action={bulk}
            extra={{ post_ids: selection }}
            onClose={() => {
              setBulk(undefined);
              setSelection([]);
            }}
          />
        )}
      </div>
    </>
  );
}
