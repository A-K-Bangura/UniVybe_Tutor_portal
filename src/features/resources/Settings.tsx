import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { request, object, page } from "../../shared/api/client";
import {
  Header,
  Loading,
  ErrorPanel,
  DataView,
} from "../../shared/ui/primitives";
import { SchemaForm } from "../../shared/forms/SchemaForm";
import { f } from "../courses/fields";
export default function ResourceSettings({
  purchases = false,
}: {
  purchases?: boolean;
}) {
  const [params, setParams] = useSearchParams(),
    cache = useQueryClient(),
    path = `admin/resources/${purchases ? "purchases" : "access-settings"}`,
    q = useQuery({
      queryKey: ["resource-admin", path, params.toString()],
      queryFn: ({ signal }) =>
        request(`${path}?${params}`, "GET", undefined, signal),
    });
  return (
    <>
      <Header
        title={purchases ? "Resource purchases" : "Resource access settings"}
        subtitle={
          purchases
            ? "Purchase records are view-only."
            : "Set daily free access and optional packs. Existing purchases retain their snapshot."
        }
      />
      <div className="panel">
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorPanel error={q.error} />
        ) : purchases ? (
          <>
            <div className="toolbar">
              <input
                aria-label="Student ID"
                placeholder="Student ID"
                onChange={(e) => setParams({ student_id: e.target.value })}
              />
              <select
                aria-label="Purchase status"
                onChange={(e) => setParams({ status: e.target.value })}
              >
                <option value="">All statuses</option>
                {["pending", "paid", "failed", "expired", "cancelled"].map(
                  (s) => (
                    <option key={s}>{s}</option>
                  ),
                )}
              </select>
            </div>
            <DataView value={page(q.data).items} />
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
          </>
        ) : (
          <>
            <DataView value={q.data.data} />
            <SchemaForm
              fields={[
                { ...f("free_daily_accesses", "number", true), max: 1000 },
                f("pack_accesses", "number"),
                f("pack_price", "number"),
                {
                  ...f("disable_pack", "boolean"),
                  label: "Stop selling access packs",
                },
                f("note"),
              ]}
              initial={{
                ...object(object(q.data.data).settings),
                pack_accesses: object(object(object(q.data.data).settings).pack)
                  .accesses,
                pack_price: object(object(object(q.data.data).settings).pack)
                  .price,
              }}
              validate={(v) =>
                !v.disable_pack &&
                Boolean(v.pack_accesses) !== Boolean(v.pack_price)
                  ? "Pack count and price must be supplied together."
                  : undefined
              }
              submit={async (values) => {
                if (values.disable_pack) {
                  values.pack_accesses = null;
                  values.pack_price = null;
                }
                delete values.disable_pack;
                await request(path, "PUT", values);
                await cache.invalidateQueries();
              }}
            />
          </>
        )}
      </div>
    </>
  );
}
