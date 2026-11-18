import { useState } from "react";
import {
  Link,
  useParams,
  useSearchParams,
  useNavigate,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  request,
  object,
  rows,
  str,
  page,
  entity,
  problem,
  type RecordData,
} from "../../shared/api/client";
import {
  Header,
  Loading,
  ErrorPanel,
  Badge,
  DataView,
  label,
} from "../../shared/ui/primitives";
import { InstitutionSelect } from "../users/InstitutionSelect";

function Stats({ value }: { value: unknown }) {
  const stats = object(value);
  return (
    <div className="ambassador-stats">
      {[
        "verified_registrations",
        "completed_onboardings",
        "activated_learners",
        "onboarding_conversion_rate",
        "learning_activation_rate",
        "flagged",
        "invalidated",
      ]
        .filter((k) => k in stats)
        .map((k) => (
          <div className="panel" key={k}>
            <span>{label(k)}</span>
            <strong>
              {stats[k] == null
                ? "—"
                : `${str(stats[k])}${k.endsWith("rate") ? "%" : ""}`}
            </strong>
          </div>
        ))}
    </div>
  );
}
function Timeline({ value }: { value: unknown }) {
  return (
    <section className="panel">
      <h2>Milestone activity</h2>
      <p>Each milestone is counted on the day it occurred.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {["Date", "Verified", "Onboarded", "Activated"].map((s) => (
                <th key={s}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows(value).map((r) => (
              <tr key={str(r.date)}>
                {["date", "verified", "onboarded", "activated"].map((k) => (
                  <td key={k}>
                    {str(r[k])}
                    {k !== "date" && (
                      <meter
                        aria-label={`${label(k)} on ${str(r.date)}`}
                        min={0}
                        max={Math.max(
                          1,
                          ...rows(value).flatMap((day) => [
                            Number(day.verified) || 0,
                            Number(day.onboarded) || 0,
                            Number(day.activated) || 0,
                          ]),
                        )}
                        value={Number(r[k]) || 0}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows(value).length && <p>No activity in this period.</p>}
    </section>
  );
}
export default function Ambassadors({
  referrals = false,
}: {
  referrals?: boolean;
}) {
  const { id } = useParams(),
    [params, setParams] = useSearchParams();
  const [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const cache = useQueryClient(),
    navigate = useNavigate();
  const base = referrals ? "referrals" : "ambassadors",
    creating = id === "new";
  const cohort = new URLSearchParams();
  for (const k of ["from", "to"])
    if (params.get(k)) cohort.set(k, params.get(k)!);
  const query = useQuery({
    queryKey: ["ambassadors", base, id, params.toString()],
    enabled: !creating,
    queryFn: async ({ signal }) =>
      id
        ? object(
            (
              await request(
                `admin/${base}/${encodeURIComponent(id)}?${cohort}`,
                "GET",
                undefined,
                signal,
              )
            ).data,
          )
        : page(
            await request(`admin/${base}?${params}`, "GET", undefined, signal),
          ),
  });
  const summaryParams = new URLSearchParams(cohort);
  if (params.get("ambassador_university_id"))
    summaryParams.set("university_id", params.get("ambassador_university_id")!);
  const summary = useQuery({
    queryKey: ["ambassadors", "summary", summaryParams.toString()],
    enabled: referrals && !id,
    queryFn: async ({ signal }) =>
      object(
        (
          await request(
            `admin/referrals/summary?${summaryParams}`,
            "GET",
            undefined,
            signal,
          )
        ).data,
      ),
  });
  const change = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };
  async function mutate(path: string, body: RecordData, method = "PUT") {
    if (uncertain || busy) return undefined;
    setBusy(true);
    setError(undefined);
    setNotice("");
    try {
      const result = await request(path, method, body);
      await cache.invalidateQueries({ queryKey: ["ambassadors"] });
      setNotice("Changes saved.");
      return result;
    } catch (e) {
      setError(e);
      if (problem(e).uncertain) setUncertain(true);
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  const select = (key: string, title: string, options: string[]) => (
    <label key={key}>
      {title}
      <select
        aria-label={title}
        value={params.get(key) || ""}
        onChange={(e) => change(key, e.target.value)}
      >
        <option value="">All / default</option>
        {options.map((v) => (
          <option key={v} value={v}>
            {label(v)}
          </option>
        ))}
      </select>
    </label>
  );
  const detail = object(query.data),
    record = object(detail[referrals ? "referral" : "ambassador"]);
  const results = query.data as
    | { items?: RecordData[]; current?: number; last?: number; total?: number }
    | undefined;
  return (
    <>
      <Header
        title={
          creating
            ? "Designate campus ambassador"
            : id
              ? referrals
                ? "Referral details"
                : "Ambassador details"
              : referrals
                ? "Referral reporting"
                : "Campus ambassadors"
        }
        subtitle="Track verified registrations, completed onboarding and first completed lessons. Referrals do not award commissions, coins or XP."
      >
        <Link className="button" to="/ambassadors">
          Campus ambassadors
        </Link>
        <Link className="button" to="/referrals">
          Referral reporting
        </Link>
        {!creating && (
          <Link className="button primary" to="/ambassadors/new">
            Designate ambassador
          </Link>
        )}
      </Header>
      {notice && <p role="status">{notice}</p>}
      {uncertain && (
        <div className="panel">
          <p>
            The save outcome is unknown. Check the current record before
            repeating it. For designation, check the ambassador list for this
            student.
          </p>
          <Link className="button" to="/ambassadors">
            Check ambassador list
          </Link>
          <button
            onClick={async () => {
              await cache.invalidateQueries({ queryKey: ["ambassadors"] });
              setUncertain(false);
              setError(undefined);
            }}
          >
            I checked the saved record
          </button>
        </div>
      )}
      {error !== undefined && (
        <>
          <ErrorPanel error={error} />
          <DataView value={problem(error).fields} />
        </>
      )}
      {creating ? (
        <DesignationEntry
          busy={busy || uncertain}
          submit={async (body) => {
            const result = await mutate("admin/ambassadors", body, "POST");
            if (result)
              navigate(`/ambassadors/${str(entity(result, "ambassador").id)}`);
          }}
        />
      ) : (
        <>
          {(!id || !referrals) && (
            <form
              className="panel ambassador-filters"
              onSubmit={(e) => e.preventDefault()}
            >
              {!id && (
                <label>
                  Search
                  <input
                    maxLength={100}
                    value={params.get("search") || ""}
                    onChange={(e) => change("search", e.target.value)}
                    placeholder={
                      referrals
                        ? "Student name, email or code"
                        : "Name, email or exact code"
                    }
                  />
                </label>
              )}
              <label>
                Verified cohort from
                <input
                  type="date"
                  value={params.get("from") || ""}
                  onChange={(e) => change("from", e.target.value)}
                />
              </label>
              <label>
                Verified cohort to
                <input
                  type="date"
                  min={params.get("from") || undefined}
                  value={params.get("to") || ""}
                  onChange={(e) => change("to", e.target.value)}
                />
              </label>
              {!id &&
                (referrals ? (
                  <>
                    <label>
                      Ambassador UUID
                      <input
                        value={params.get("ambassador_id") || ""}
                        onChange={(e) =>
                          change("ambassador_id", e.target.value)
                        }
                      />
                    </label>
                    <InstitutionSelect
                      title="Ambassador campus"
                      kind="universities"
                      value={params.get("ambassador_university_id") || ""}
                      onChange={(v) => change("ambassador_university_id", v)}
                    />
                    <InstitutionSelect
                      title="Student campus"
                      kind="universities"
                      value={params.get("student_university_id") || ""}
                      onChange={(v) => change("student_university_id", v)}
                    />
                    {select("review_status", "Review status", [
                      "ok",
                      "flagged",
                      "invalidated",
                    ])}
                    {select("source", "Source", ["link", "manual"])}
                    {select("onboarded", "Onboarding completed", [
                      "true",
                      "false",
                    ])}
                    {select("activated", "Learning activated", [
                      "true",
                      "false",
                    ])}
                    {select("sort", "Sort by", [
                      "verified_at",
                      "onboarding_completed_at",
                      "activated_at",
                    ])}
                  </>
                ) : (
                  <>
                    {select("status", "Status", ["active", "inactive"])}
                    <InstitutionSelect
                      title="Campus"
                      kind="universities"
                      value={params.get("university_id") || ""}
                      onChange={(v) => change("university_id", v)}
                    />
                    {select("sort", "Sort by", [
                      "verified",
                      "onboarded",
                      "activated",
                      "appointed_at",
                      "code",
                    ])}
                  </>
                ))}
              {!id && select("order", "Sort order", ["desc", "asc"])}
              <button type="button" onClick={() => setParams({})}>
                Clear filters
              </button>
            </form>
          )}
          {referrals && !id && (
            <section aria-label="Referral summary">
              <h2>Campus and cohort summary</h2>
              <p>
                Summary uses cohort dates and ambassador campus. Other filters
                apply to the records below. Invalidated referrals are excluded
                from counts; flagged referrals remain included.
              </p>
              {summary.isPending ? (
                <Loading />
              ) : summary.isError ? (
                <ErrorPanel
                  error={summary.error}
                  retry={() => void summary.refetch()}
                />
              ) : (
                <>
                  <Stats value={summary.data.totals} />
                  <p>
                    Ambassadors: {str(object(summary.data.ambassadors).total)} ·
                    Active: {str(object(summary.data.ambassadors).active)}
                  </p>
                  <div className="panel">
                    <h3>By campus</h3>
                    {rows(summary.data.by_university).map((r, i) => (
                      <section key={i}>
                        <h4>{str(object(r.university).name) || "No campus"}</h4>
                        <Stats value={r} />
                      </section>
                    ))}
                  </div>
                  <Timeline value={summary.data.timeline} />
                </>
              )}
            </section>
          )}
          {query.isPending ? (
            <Loading />
          ) : query.isError ? (
            <ErrorPanel
              error={query.error}
              retry={() => void query.refetch()}
            />
          ) : id ? (
            <>
              <section className="panel">
                <h2>
                  {str(object(record.student).name) ||
                    str(object(record.student).email) ||
                    "New student"}
                </h2>
                <Badge value={record.status || record.stage} />
                {referrals ? (
                  <DataView value={record} />
                ) : (
                  <>
                    <p>
                      <strong>{str(record.code)}</strong> ·{" "}
                      {str(object(record.university).name) || "No campus"}
                    </p>
                    <p className="prewrap">{str(record.referral_link)}</p>
                    <DataView
                      value={{
                        student: record.student,
                        appointed_at: record.appointed_at,
                        appointed_by: record.appointed_by,
                        deactivated_at: record.deactivated_at,
                        deactivation_reason: record.deactivation_reason,
                      }}
                    />
                    <Stats value={record.stats} />
                    <Link
                      className="button"
                      to={`/referrals?ambassador_id=${encodeURIComponent(str(record.id))}`}
                    >
                      View referrals
                    </Link>
                  </>
                )}
              </section>
              {referrals ? (
                <Review
                  key={str(record.id) + str(object(record.review).reviewed_at)}
                  record={record}
                  busy={busy || uncertain}
                  submit={(body) =>
                    mutate(
                      `admin/referrals/${encodeURIComponent(id)}/review`,
                      body,
                    )
                  }
                />
              ) : (
                <>
                  <AmbassadorEdit
                    key={str(record.id)}
                    record={record}
                    busy={busy || uncertain}
                    submit={(body) =>
                      mutate(
                        `admin/ambassadors/${encodeURIComponent(id)}`,
                        body,
                      )
                    }
                    toggle={(body) =>
                      mutate(
                        `admin/ambassadors/${encodeURIComponent(id)}/${record.status === "active" ? "deactivate" : "activate"}`,
                        body,
                      )
                    }
                  />
                  <Timeline value={detail.timeline} />
                  <section className="panel">
                    <h2>Review signals</h2>
                    <p>
                      Shared IP addresses are leads for human review, not proof
                      of abuse. Campus Wi-Fi and proxy configuration can affect
                      these signals.
                    </p>
                    <DataView value={detail.signals} />
                    {rows(object(detail.signals).ip_clusters).map((r, i) => (
                      <p key={i}>
                        {str(r.ip)} · {str(r.referrals)} referrals
                      </p>
                    ))}
                  </section>
                  <section className="panel">
                    <h2>Audit history</h2>
                    <DataView value={detail.events} />
                  </section>
                </>
              )}
            </>
          ) : (
            <>
              <div className="table-wrap panel">
                <table>
                  <thead>
                    <tr>
                      {(referrals
                        ? [
                            "Student",
                            "Ambassador",
                            "Stage",
                            "Source",
                            "Review",
                            "Verified",
                            "Details",
                          ]
                        : [
                            "Ambassador",
                            "Code",
                            "Campus",
                            "Status",
                            "Verified",
                            "Onboarded",
                            "Activated",
                            "Details",
                          ]
                      ).map((s) => (
                        <th key={s}>{s}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results?.items?.map((r) => (
                      <tr key={str(r.id)}>
                        <td>
                          {str(object(r.student).name) ||
                            str(object(r.student).email) ||
                            "New student"}
                        </td>
                        {referrals ? (
                          <>
                            <td>
                              <Link
                                to={`/ambassadors/${str(object(r.ambassador).id)}`}
                              >
                                {str(object(r.ambassador).name)} ·{" "}
                                {str(r.code_used)}
                              </Link>
                            </td>
                            <td>{str(r.stage)}</td>
                            <td>{str(r.source)}</td>
                            <td>
                              <Badge value={object(r.review).status} />
                            </td>
                            <td>{str(r.verified_at)}</td>
                          </>
                        ) : (
                          <>
                            <td>{str(r.code)}</td>
                            <td>
                              {str(object(r.university).name) || "No campus"}
                            </td>
                            <td>
                              <Badge value={r.status} />
                            </td>
                            {[
                              "verified_registrations",
                              "completed_onboardings",
                              "activated_learners",
                            ].map((k) => (
                              <td key={k}>{str(object(r.stats)[k])}</td>
                            ))}
                          </>
                        )}
                        <td>
                          <Link className="button" to={`/${base}/${str(r.id)}`}>
                            View details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!results?.items?.length && (
                  <p>No records match these filters.</p>
                )}
              </div>
              <div className="actions">
                <button
                  disabled={(results?.current || 1) <= 1}
                  onClick={() =>
                    change("page", String((results?.current || 1) - 1))
                  }
                >
                  Previous
                </button>
                <span>
                  Page {results?.current || 1} of{" "}
                  {Math.max(1, results?.last || 1)} · {results?.total || 0}{" "}
                  records
                </span>
                <button
                  disabled={(results?.current || 1) >= (results?.last || 1)}
                  onClick={() =>
                    change("page", String((results?.current || 1) + 1))
                  }
                >
                  Next
                </button>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
function DesignationEntry(props: {
  busy: boolean;
  submit: (body: RecordData) => Promise<void>;
}) {
  const [params] = useSearchParams();
  const id = params.get("student_id");
  const q = useQuery({
    queryKey: ["detail", "users", id],
    enabled: !!id,
    queryFn: async ({ signal }) =>
      entity(
        await request(
          `admin/users/${encodeURIComponent(id!)}`,
          "GET",
          undefined,
          signal,
        ),
        "user",
      ),
  });
  if (!id) return <Designation {...props} />;
  if (q.isPending) return <Loading />;
  if (q.isError)
    return <ErrorPanel error={q.error} retry={() => void q.refetch()} />;
  const user = q.data;
  // User detail returns raw models; student records have no creation-user role.
  const isStudent =
    user.user_type === "student" ||
    user.type === "student" ||
    object(user.role).name === "student" ||
    (!user.role_id && !user.role);
  if (!isStudent)
    return (
      <p className="notice">
        Only student accounts can be designated as ambassadors.{" "}
        <Link to="/ambassadors/new">Find a student</Link>
      </p>
    );
  if (user.status !== "active" || !user.firstname || !user.lastname)
    return (
      <p className="notice">
        This student must have an active account and completed onboarding before
        designation.{" "}
        <Link to={`/users/${encodeURIComponent(id)}`}>
          Back to student profile
        </Link>
      </p>
    );
  return (
    <Designation
      {...props}
      key={id}
      initialStudent={{
        ...user,
        id: user.uuid || user.id,
        name: user.full_name || `${str(user.firstname)} ${str(user.lastname)}`,
      }}
    />
  );
}
function Designation({
  busy,
  submit,
  initialStudent,
}: {
  busy: boolean;
  submit: (body: RecordData) => Promise<void>;
  initialStudent?: RecordData;
}) {
  const [search, setSearch] = useState(""),
    [term, setTerm] = useState(""),
    [student, setStudent] = useState<RecordData | undefined>(initialStudent);
  const q = useQuery({
    queryKey: ["ambassadors", "student-search", term],
    enabled: term.length >= 2,
    queryFn: async ({ signal }) =>
      rows(
        object(
          (
            await request(
              `admin/ambassadors/student-search?q=${encodeURIComponent(term)}`,
              "GET",
              undefined,
              signal,
            )
          ).data,
        ).students,
      ),
  });
  return (
    <section className="panel designation-panel">
      <div className="designation-intro">
        <h2>Choose a student</h2>
        <p>
          Designate an existing student to represent a campus and track their
          referrals.
        </p>
      </div>
      {!initialStudent && (
        <>
          <form
            className="designation-search"
            onSubmit={(e) => {
              e.preventDefault();
              setStudent(undefined);
              setTerm(search.trim());
            }}
          >
            <label>
              Find student
              <input
                minLength={2}
                required
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, email or phone"
              />
            </label>
            <button className="primary" disabled={busy}>
              Search students
            </button>
          </form>
          {term &&
            (q.isPending ? (
              <Loading />
            ) : q.isError ? (
              <ErrorPanel error={q.error} />
            ) : (
              <div className="data-list">
                {!q.data?.length && <p>No active students found.</p>}
                {q.data?.map((r) => (
                  <div className="designation-result" key={str(r.id)}>
                    <div>
                      <strong>{str(r.name) || "New student"}</strong>
                      <p>{str(r.email)}</p>
                      <small>
                        {str(object(r.university).name) || "No campus"}
                      </small>
                    </div>
                    <button
                      disabled={
                        !!r.is_ambassador || !r.onboarding_completed || busy
                      }
                      onClick={() => setStudent(r)}
                    >
                      {r.is_ambassador
                        ? "Already an ambassador"
                        : !r.onboarding_completed
                          ? "Onboarding incomplete"
                          : student?.id === r.id
                            ? "Selected"
                            : "Select student"}
                    </button>
                  </div>
                ))}
              </div>
            ))}
        </>
      )}
      {student && (
        <form
          className="designation-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            await submit({
              student_id: student.id,
              ...(data.get("code") ? { code: data.get("code") } : {}),
              ...(data.get("university_id")
                ? { university_id: Number(data.get("university_id")) }
                : {}),
              notes: data.get("notes") || null,
            });
          }}
        >
          <div className="designation-heading">
            <span className="eyebrow">Selected student</span>
            <h3>Designate {str(student.name)}</h3>
            <p>{str(student.email)}</p>
            {initialStudent && (
              <Link
                className="button"
                to={`/users/${encodeURIComponent(str(student.uuid || student.id))}`}
              >
                Back to student profile
              </Link>
            )}
          </div>
          <div className="designation-fields">
            <label>
              Custom code (optional)
              <input name="code" pattern="[A-Za-z0-9]{4,20}" maxLength={20} />
            </label>
            <CampusField initial="" />
          </div>
          <p className="designation-help">
            Leave campus blank to use the student's university. Codes are
            permanent.
          </p>
          <label>
            Admin notes
            <textarea name="notes" maxLength={2000} />
          </label>
          <div className="designation-footer">
            <p>The student keeps their existing account and learning access.</p>
            <button className="primary" disabled={busy}>
              {busy ? "Designating…" : "Designate ambassador"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
function CampusField({ initial }: { initial: string }) {
  const [campus, setCampus] = useState(initial);
  return (
    <>
      <InstitutionSelect
        title="Campus"
        kind="universities"
        value={campus}
        onChange={setCampus}
      />
      <input type="hidden" name="university_id" value={campus} />
    </>
  );
}
function AmbassadorEdit({
  record,
  busy,
  submit,
  toggle,
}: {
  record: RecordData;
  busy: boolean;
  submit: (body: RecordData) => Promise<unknown>;
  toggle: (body: RecordData) => Promise<unknown>;
}) {
  return (
    <section className="panel">
      <h2>Manage ambassador</h2>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          void submit({
            university_id: data.get("university_id")
              ? Number(data.get("university_id"))
              : null,
            notes: data.get("notes") || null,
          });
        }}
      >
        <CampusField initial={str(object(record.university).id)} />
        <label>
          Admin notes
          <textarea
            name="notes"
            maxLength={2000}
            defaultValue={str(record.notes)}
          />
        </label>
        <button disabled={busy}>Save campus and notes</button>
      </form>
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          void toggle(
            record.status === "active"
              ? { reason: data.get("reason") || null }
              : {},
          );
        }}
      >
        {record.status === "active" && (
          <label>
            Deactivation reason (optional)
            <input name="reason" maxLength={255} />
          </label>
        )}
        <button disabled={busy}>
          {record.status === "active"
            ? "Deactivate ambassador"
            : "Activate ambassador"}
        </button>
      </form>
      <p>
        Deactivation pauses new referrals and preserves the code, student
        account and referral history.
      </p>
    </section>
  );
}
function Review({
  record,
  busy,
  submit,
}: {
  record: RecordData;
  busy: boolean;
  submit: (body: RecordData) => Promise<unknown>;
}) {
  const [status, setStatus] = useState(
    str(object(record.review).status) || "ok",
  );
  return (
    <form
      className="panel form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        void submit({ review_status: status, note: data.get("note") || null });
      }}
    >
      <h2>Review referral</h2>
      <label>
        Review status
        <select
          aria-label="Review status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {["ok", "flagged", "invalidated"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <label>
        Review note
        <textarea
          name="note"
          maxLength={2000}
          required={status !== "ok"}
          defaultValue={str(object(record.review).note)}
        />
      </label>
      <p>
        Flagged referrals remain counted. Invalidated referrals stay in history
        but are excluded from counts.
      </p>
      <button disabled={busy}>Save review</button>
    </form>
  );
}
