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
  page,
  entity,
  str,
  type RecordData,
} from "../../shared/api/client";
import {
  Header,
  DataView,
  Loading,
  ErrorPanel,
  Badge,
} from "../../shared/ui/primitives";
import { SchemaForm, type Field } from "../../shared/forms/SchemaForm";
import { f } from "../courses/fields";
import { InstitutionSelect } from "../users/InstitutionSelect";
import { PeriodClosure } from "./PeriodClosure";
const names: Record<string, string> = {
  "academic-periods": "Academic periods",
  "course-packs": "Course packs",
  "course-pack-purchases": "Pack purchases",
  "course-access": "Course access",
};
export default function PaidAccess({ kind }: { kind: string }) {
  const { id } = useParams(),
    [params, setParams] = useSearchParams(),
    cache = useQueryClient(),
    navigate = useNavigate();
  const [closing, setClosing] = useState(false),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  const period = kind === "academic-periods",
    pack = kind === "course-packs",
    editable = period || pack,
    creating = id === "new",
    key = period ? "period" : pack ? "pack" : "purchase";
  const q = useQuery({
    queryKey: ["paid-access", kind, id, params.toString()],
    enabled: !creating,
    queryFn: async ({ signal }) => {
      const r = await request(
        `admin/${kind}${id ? `/${encodeURIComponent(id)}` : ""}?${params}`,
        "GET",
        undefined,
        signal,
      );
      return id
        ? { record: entity(r, key) }
        : { ...page(r), summary: object(r.summary || object(r.data).summary) };
    },
  });
  const events = useQuery({
    queryKey: ["paid-access", "events", id],
    enabled: period && !!id && !creating,
    queryFn: ({ signal }) =>
      request(
        `admin/academic-periods/${encodeURIComponent(id!)}/events`,
        "GET",
        undefined,
        signal,
      ),
  });
  const data = object(q.data),
    record = object(data.record);
  const change = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== "page") next.delete("page");
    setParams(next);
  };
  const select = (k: string, options: string[]) => (
    <label key={k}>
      {k.replaceAll("_", " ")}
      <select
        aria-label={`${k} filter`}
        value={params.get(k) || ""}
        onChange={(e) => change(k, e.target.value)}
      >
        <option value="">All</option>
        {options.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </label>
  );
  const fields: Field[] = period
    ? [
        ...(creating || record.status === "upcoming"
          ? [
              { ...f("university_id", "select", true), label: "University" },
              f("type", "select", true, ["semester", "academic_year"]),
              {
                ...f("academic_year", "text", true),
                help: "Two consecutive years, e.g. 2026/2027",
              },
              {
                ...f("period_semester", "number"),
                min: 1,
                max: 4,
                visibleWhen: { field: "type", value: "semester" },
              },
            ]
          : []),
        { ...f("name"), nullable: true, maxLength: 150 },
        { ...f("expected_starts_on", "date"), nullable: true },
        { ...f("expected_ends_on", "date"), nullable: true },
      ]
    : [
        f("name", "text", true),
        { ...f("description", "textarea"), nullable: true, maxLength: 2000 },
        { ...f("unlock_count", "number", true), min: 1, max: 1000 },
        { ...f("price", "number", true), min: 0.01 },
        f("validity_type", "select", true, ["semester", "academic_year"]),
        { ...f("promo_price", "number"), nullable: true, min: 0.01 },
        {
          ...f("promo_starts_at", "datetime-local"),
          nullable: true,
          help: `Optional. Your local time (${Intl.DateTimeFormat().resolvedOptions().timeZone}).`,
        },
        {
          ...f("promo_ends_at", "datetime-local"),
          nullable: true,
          help: `Optional. Your local time (${Intl.DateTimeFormat().resolvedOptions().timeZone}).`,
        },
        f("is_active", "boolean"),
      ];
  async function toggle() {
    setBusy(true);
    setError(undefined);
    try {
      await request(
        `admin/${kind}/${encodeURIComponent(id!)}/${period ? "open" : record.is_active ? "deactivate" : "activate"}`,
        "PUT",
        {},
      );
      await cache.invalidateQueries({ queryKey: ["paid-access"] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Header
        title={names[kind]}
        subtitle={
          period
            ? "Periods open and close only by an administrator's action. Dates are informational."
            : "Paid access is tied to the student's university period. Existing purchases retain their original settings."
        }
      >
        {Object.entries(names).map(([k, n]) => (
          <Link className="button" key={k} to={`/${k}`}>
            {n}
          </Link>
        ))}
        {editable && !creating && (
          <Link className="button primary" to={`/${kind}/new`}>
            Create {period ? "period" : "pack"}
          </Link>
        )}
      </Header>
      {error !== undefined && (
        <ErrorPanel error={error} retry={() => void q.refetch()} />
      )}
      {!id && (
        <div className="panel ambassador-filters">
          {!period && (
            <label>
              Search
              <input
                maxLength={100}
                value={params.get("search") || ""}
                onChange={(e) => change("search", e.target.value)}
              />
            </label>
          )}
          {!pack && (
            <InstitutionSelect
              title="University"
              kind="universities"
              value={params.get("university_id") || ""}
              onChange={(v) => change("university_id", v)}
            />
          )}
          {period ? (
            <>
              {select("type", ["semester", "academic_year"])}
              {select("status", ["upcoming", "active", "closed"])}
              <label>
                Academic year
                <input
                  value={params.get("academic_year") || ""}
                  onChange={(e) => change("academic_year", e.target.value)}
                />
              </label>
            </>
          ) : pack ? (
            <>
              {select("is_active", ["1", "0"])}
              {select("validity_type", ["semester", "academic_year"])}
            </>
          ) : (
            <>
              {select(
                "status",
                kind === "course-access"
                  ? ["active", "expired"]
                  : ["pending", "succeeded", "failed", "cancelled", "expired"],
              )}
              {(kind === "course-access"
                ? ["source", "needs_attention"]
                : ["pack_state", "promo_applied"]
              ).map((k) =>
                select(
                  k,
                  k === "source"
                    ? ["purchase", "pack_unlock"]
                    : k === "pack_state"
                      ? ["active", "exhausted", "expired"]
                      : ["1", "0"],
                ),
              )}
              {[
                "student_id",
                "academic_period_id",
                kind === "course-access" ? "course_id" : "course_pack_id",
              ].map((k) => (
                <label key={k}>
                  {k.replaceAll("_", " ")}
                  <input
                    type="number"
                    min={1}
                    value={params.get(k) || ""}
                    onChange={(e) => change(k, e.target.value)}
                  />
                </label>
              ))}
              {kind === "course-pack-purchases" &&
                ["from", "to"].map((k) => (
                  <label key={k}>
                    {k}
                    <input
                      type="date"
                      value={params.get(k) || ""}
                      onChange={(e) => change(k, e.target.value)}
                    />
                  </label>
                ))}
            </>
          )}
          <button onClick={() => setParams({})}>Clear filters</button>
        </div>
      )}
      {kind === "course-access" && !id && (
        <div className="tabs">
          <button
            aria-pressed={!params.get("needs_attention")}
            onClick={() => change("needs_attention", "")}
          >
            All access
          </button>
          <button
            aria-pressed={params.get("needs_attention") === "1"}
            onClick={() => change("needs_attention", "1")}
          >
            Needs attention
          </button>
        </div>
      )}
      {creating ? (
        <SchemaForm
          fields={fields}
          initial={
            period
              ? { type: "semester" }
              : { validity_type: "semester", is_active: true }
          }
          submit={async (values) => {
            if (period && values.period_semester) {
              values.semester = values.period_semester;
            }
            delete values.period_semester;
            if (period && values.type === "academic_year")
              delete values.semester;
            if (pack && !values.promo_price) {
              delete values.promo_starts_at;
              delete values.promo_ends_at;
            }
            const r = entity(
              await request(`admin/${kind}`, "POST", values),
              key,
            );
            await cache.invalidateQueries({ queryKey: ["paid-access"] });
            navigate(`/${kind}/${str(r.uuid || r.id)}`);
          }}
          button={`Create ${period ? "period" : "pack"}`}
        />
      ) : q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorPanel error={q.error} retry={() => void q.refetch()} />
      ) : id ? (
        <>
          <section className="panel">
            <h2>
              {str(record.name || record.pack_name) || "Purchase details"}
            </h2>
            <Badge value={record.status} />
            <DataView value={record} />
          </section>
          {editable && (!period || record.status !== "closed") && (
            <>
              <SchemaForm
                key={JSON.stringify(record)}
                fields={fields}
                initial={{ ...record, period_semester: record.semester }}
                button="Save settings"
                submit={async (values) => {
                  if (period && values.period_semester) {
                    values.semester = values.period_semester;
                  }
                  delete values.period_semester;
                  if (period && values.type === "academic_year")
                    delete values.semester;
                  if (pack && !values.promo_price) {
                    values.promo_starts_at = null;
                    values.promo_ends_at = null;
                  }
                  await request(
                    `admin/${kind}/${encodeURIComponent(id)}`,
                    "PUT",
                    values,
                  );
                  await cache.invalidateQueries({ queryKey: ["paid-access"] });
                }}
              />
              <div className="actions">
                {(!period || record.status === "upcoming") && (
                  <button disabled={busy} onClick={() => void toggle()}>
                    {period
                      ? "Open period"
                      : record.is_active
                        ? "Deactivate pack"
                        : "Activate pack"}
                  </button>
                )}
                {period && record.status === "active" && (
                  <button onClick={() => setClosing(true)}>
                    Preview closure
                  </button>
                )}
              </div>
            </>
          )}
          {period && (
            <section className="panel">
              <h2>Audit history</h2>
              {events.isError ? (
                <ErrorPanel error={events.error} />
              ) : (
                <DataView value={events.data?.data} />
              )}
            </section>
          )}
        </>
      ) : (
        <>
          <section className="panel">
            <h2>{editable ? "Catalogue" : "Filtered summary"}</h2>
            <DataView value={data.summary} />
          </section>
          {((data.items as RecordData[]) || []).map((r) => (
            <section className="panel" key={str(r.uuid || r.id)}>
              <h2>
                {str(
                  r.name ||
                    object(r.student).full_name ||
                    object(r.student).name,
                ) || names[kind]}
              </h2>
              <DataView value={r} />
              {kind !== "course-access" && (
                <Link className="button" to={`/${kind}/${str(r.uuid || r.id)}`}>
                  View details
                </Link>
              )}
            </section>
          ))}
          {!((data.items as unknown[]) || []).length && (
            <p>No records match these filters.</p>
          )}
          <div className="actions">
            <button
              disabled={Number(data.current) <= 1}
              onClick={() => change("page", String(Number(data.current) - 1))}
            >
              Previous
            </button>
            <span>
              Page {str(data.current)} of {Math.max(1, Number(data.last) || 1)}{" "}
              · {str(data.total)} records
            </span>
            <button
              disabled={Number(data.current) >= Number(data.last)}
              onClick={() => change("page", String(Number(data.current) + 1))}
            >
              Next
            </button>
          </div>
        </>
      )}
      {closing && <PeriodClosure id={id!} onClose={() => setClosing(false)} />}
    </>
  );
}
