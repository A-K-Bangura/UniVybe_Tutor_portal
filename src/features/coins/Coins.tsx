import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, object, entity, page, str } from "../../shared/api/client";
import {
  Header,
  Loading,
  ErrorPanel,
  DataView,
  Badge,
} from "../../shared/ui/primitives";
import { SchemaForm } from "../../shared/forms/SchemaForm";
import { f } from "../courses/fields";
import { Decision } from "../reviews/Decision";
import { exchangeSchema } from "./dto";
export default function Coins({ view }: { view: string }) {
  const { id } = useParams(),
    [params, setParams] = useSearchParams(),
    cache = useQueryClient(),
    [action, setAction] = useState<string>();
  const endpoint = view === "ledger" ? "transactions" : view;
  const q = useQuery({
    queryKey: ["coins", endpoint, id, params.toString()],
    queryFn: async ({ signal }) => {
      const response = await request(
        `admin/coins/${endpoint}${id ? `/${id}` : ""}?${params}`,
        "GET",
        undefined,
        signal,
      );
      if (
        id &&
        !exchangeSchema.safeParse(object(response.data).exchange).success
      )
        throw new Error(
          "The server returned an invalid financial snapshot. Settlement controls are unavailable.",
        );
      return response;
    },
  });
  if (q.isPending) return <Loading />;
  if (q.isError)
    return <ErrorPanel error={q.error} retry={() => void q.refetch()} />;
  const data = object(q.data.data),
    exchange = id ? entity(q.data, "exchange") : undefined;
  return (
    <>
      <Header
        title={
          view === "settings"
            ? "Vybe Coin settings"
            : view === "ledger"
              ? "Coin ledger"
              : id
                ? "Exchange request"
                : "Exchange queue"
        }
        subtitle={
          view === "exchanges"
            ? "Payouts happen manually. This workspace records their outcomes."
            : "Server balances and request snapshots are authoritative."
        }
      />
      <div className="panel">
        {view === "settings" ? (
          <>
            <DataView value={data} />
            <SchemaForm
              fields={[
                f("rate_coins", "number", true),
                f("rate_leones", "number", true),
                f("min_exchange_coins", "number", true),
                f("note"),
                {
                  ...f("announce", "boolean"),
                  label: "Publish feed announcement",
                },
              ]}
              initial={{
                rate_coins: object(object(data.settings).rate).coins,
                rate_leones: object(object(data.settings).rate).leones,
                min_exchange_coins: object(data.settings).min_exchange_coins,
                announce: false,
              }}
              submit={async (values) => {
                await request("admin/coins/settings", "PUT", values);
                await cache.invalidateQueries();
              }}
            />
          </>
        ) : exchange ? (
          <>
            <DataView value={data} />
            {["pending", "processing"].includes(str(exchange.status)) && (
              <div className="actions">
                {["processing", "complete", "reject", "fail"].map((a) => (
                  <button
                    key={a}
                    onClick={async () => {
                      await q.refetch();
                      setAction(a);
                    }}
                  >
                    {a === "complete"
                      ? "Record payment completed"
                      : a === "processing"
                        ? "Mark processing"
                        : a === "fail"
                          ? "Record failed payout"
                          : "Reject request"}
                  </button>
                ))}
              </div>
            )}
            {action && (
              <Decision
                kind="coins/exchanges"
                id={id!}
                action={action}
                snapshot={exchange}
                onClose={() => setAction(undefined)}
              />
            )}
          </>
        ) : (
          <>
            <div className="toolbar">
              <input
                aria-label="Student ID or UUID"
                placeholder="Student ID or UUID"
                value={params.get("student_id") || ""}
                onChange={(e) => setParams({ student_id: e.target.value })}
              />
              {view === "exchanges" && (
                <>
                  <select
                    aria-label="Exchange status"
                    value={params.get("status") || ""}
                    onChange={(e) => setParams({ status: e.target.value })}
                  >
                    <option value="">All statuses</option>
                    {[
                      "pending",
                      "processing",
                      "completed",
                      "rejected",
                      "failed",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <button
                    onClick={() =>
                      setParams({ status: "pending", sort_order: "asc" })
                    }
                  >
                    Pending · oldest first
                  </button>
                </>
              )}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>{view === "ledger" ? "Movement" : "Coins"}</th>
                    <th>SLE / balance</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {page(q.data).items.map((r) => (
                    <tr key={str(r.id)}>
                      <td>
                        {str(
                          object(r.student).full_name ||
                            object(r.student).email,
                        )}
                      </td>
                      <td>{str(r.type || r.coins)}</td>
                      <td>{str(r.leone_amount ?? r.available_after) || "—"}</td>
                      <td>
                        {view === "ledger" && (
                          <details>
                            <summary>Movement details</summary>
                            <DataView value={r} />
                          </details>
                        )}
                        <Badge value={r.status} />
                      </td>
                      <td>{str(r.created_at).slice(0, 10)}</td>
                      <td>
                        {view === "exchanges" && (
                          <Link to={`/coins/exchanges/${str(r.uuid || r.id)}`}>
                            Review
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>{page(q.data).total} records</span>
              <button
                disabled={page(q.data).current >= page(q.data).last}
                onClick={() =>
                  setParams({
                    ...Object.fromEntries(params),
                    page: String(page(q.data).current + 1),
                  })
                }
              >
                Next page
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
