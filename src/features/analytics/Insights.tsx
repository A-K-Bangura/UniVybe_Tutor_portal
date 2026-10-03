import { useState, lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useParams } from "react-router-dom";
import { request, page, str, object, rows } from "../../shared/api/client";
import { useSession } from "../../shared/auth/session";
import {
  DataView,
  ErrorPanel,
  Header,
  Loading,
} from "../../shared/ui/primitives";
import { SchemaForm } from "../../shared/forms/SchemaForm";
import { f } from "../courses/fields";
const RevenueChart = lazy(() => import("./RevenueChart"));
export default function Insights({ view = "dashboard" }: { view?: string }) {
  const { id } = useParams();
  const role = useSession((s) => s.user!.role.name),
    admin = ["admin", "moderator"].includes(role),
    [tab, setTab] = useState("dashboard"),
    [params, setParams] = useSearchParams(),
    [metadata, setMetadata] = useState<unknown>(),
    cache = useQueryClient();
  const prefix = admin ? "admin" : "tutor",
    effective = view === "analytics" ? tab : view,
    endpoint =
      view === "course"
        ? `tutor/analytics/course/${encodeURIComponent(id || "")}`
        : `${prefix}/analytics/${effective}`;
  const q = useQuery({
    queryKey: ["insights", endpoint, params.toString()],
    queryFn: ({ signal }) =>
      request(`${endpoint}?${params}`, "GET", undefined, signal),
  });
  return (
    <>
      <Header
        title={
          view === "system-health"
            ? "System health"
            : view === "reports"
              ? "Reports"
              : admin
                ? "Platform insights"
                : "Teaching insights"
        }
        subtitle={
          view === "reports"
            ? "Completed report records and metadata. File delivery is not yet available."
            : "Real server data. Revenue is gross course sales, before fees or revenue sharing."
        }
      />
      {view === "analytics" && (
        <div className="tabs">
          {(admin
            ? ["dashboard", "users", "courses", "engagement", "learning"]
            : [
                "dashboard",
                "student-engagement",
                "content-performance",
                "effectiveness",
              ]
          ).map((t) => (
            <button
              className={tab === t ? "selected" : ""}
              onClick={() => setTab(t)}
              key={t}
            >
              {t.replaceAll("-", " ")}
            </button>
          ))}
        </div>
      )}
      {!["reports", "system-health"].includes(view) && (
        <div className="toolbar">
          <label>
            Period{" "}
            <select
              value={params.get("period") || "month"}
              onChange={(e) => setParams({ period: e.target.value })}
            >
              {["week", "month", "quarter", "year"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className="panel">
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorPanel error={q.error} retry={() => void q.refetch()} />
        ) : view === "reports" ? (
          <>
            {page(q.data).items.map((r) => (
              <div className="sequence-row" key={str(r.id)}>
                <span>{str(r.report_type)}</span>
                <span>{str(r.status)}</span>
                <button
                  onClick={async () => {
                    try {
                      const m = await request(
                        `${prefix}/analytics/reports/${str(r.uuid)}/download`,
                      );
                      setMetadata(m.data);
                    } catch (e) {
                      setMetadata(e);
                    }
                  }}
                >
                  Inspect metadata
                </button>
              </div>
            ))}
            {metadata !== undefined &&
              (metadata instanceof Error ? (
                <ErrorPanel error={metadata} />
              ) : (
                <DataView value={metadata} />
              ))}
            <div className="pagination">
              <span>{page(q.data).total} reports</span>
              <button
                disabled={page(q.data).current >= page(q.data).last}
                onClick={() =>
                  setParams({ page: String(page(q.data).current + 1) })
                }
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <DataView value={q.data.data} />
        )}
      </div>
      {admin && effective === "dashboard" && q.data && (
        <Suspense fallback={<Loading />}>
          <RevenueChart
            data={rows(object(object(q.data.data).trends).revenue_trend)}
          />
        </Suspense>
      )}
      {view === "reports" && role !== "moderator" && (
        <div className="panel">
          <h2>Generate report</h2>
          <SchemaForm
            fields={[
              f(
                "report_type",
                "select",
                true,
                admin
                  ? [
                      "platform_overview",
                      "user_analysis",
                      "course_performance",
                      "engagement_summary",
                      "system_health",
                    ]
                  : [
                      "course_performance",
                      "student_progress",
                      "teaching_effectiveness",
                      "content_analysis",
                    ],
              ),
              f("period_type", "select", true, [
                "daily",
                "weekly",
                "monthly",
                "quarterly",
                "yearly",
              ]),
              ...(!admin ? [f("course_id", "number")] : []),
              f("include_recommendations", "boolean"),
              ...(admin ? [f("include_charts", "boolean")] : []),
            ]}
            button="Generate report"
            submit={async (values) => {
              await request(endpoint, "POST", values);
              await cache.invalidateQueries();
            }}
          />
        </div>
      )}
    </>
  );
}
