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
  p.set("per_page", "15");
  const q = useQuery({
    queryKey: ["collection", kind, role, p.toString()],
    queryFn: ({ signal }) => list(kind, role, p, signal),
  });
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };
  const Icon = icons[kind] || Files;
  return (
    <>
      <Header
        title={review ? `Review ${kind}` : label(kind)}
        subtitle={
          review
            ? "Read the full record before making a decision."
            : "Your work, in one place. Create, refine, and keep things moving."
        }
      >
        {!review && (
          <Link className="button primary" to={`/${kind}/new`}>
            <Plus size={17} /> Create{" "}
            {kind === "feed"
              ? "post"
              : kind.replace(/ies$/, "y").replace(/s$/, "")}
          </Link>
        )}
      </Header>
      <div className="toolbar">
        <div className="search-input">
          <Search size={18} />
          <input
            aria-label={`Search ${kind}`}
            placeholder={`Search ${kind}…`}
            value={params.get("search") || ""}
            onChange={(e) => set("search", e.target.value)}
          />
        </div>
        {statuses[kind] && (
          <select
            aria-label="Filter by status"
            value={params.get("status") || ""}
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
        <button onClick={() => setParams({})}>Clear filters</button>
      </div>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorPanel error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          {!q.data.items.length ? (
            <div className="empty">
              <Icon size={36} />
              <h2>{params.size ? "No matching records" : "A fresh start"}</h2>
              <p>
                {params.size
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
                          <Link className="entity-title" to={`/${kind}/${id}`}>
                            {str(
                              item.title ||
                                item.name ||
                                item.full_name ||
                                item.email,
                            ) || "Untitled"}
                          </Link>
                          <small>
                            {str(item.short_description || item.email)}
                          </small>
                        </td>
                        <td>
                          <Badge
                            value={
                              item.status ??
                              (item.is_active === true ? "active" : undefined)
                            }
                          />
                        </td>
                        <td>
                          {str(
                            object(item.creator).full_name ||
                              object(item.university).name ||
                              item.resource_type ||
                              item.opportunity_type ||
                              item.type,
                          ) || "—"}
                        </td>
                        <td>
                          {str(item.updated_at || item.created_at).slice(
                            0,
                            10,
                          ) || "—"}
                        </td>
                        <td>
                          <Link to={`/${kind}/${id}`} aria-label="Open record">
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
                    {str(item.thumbnail_url || object(item.cover_image).url) ? (
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
                    </div>
                    <h2>{str(item.title) || "Untitled"}</h2>
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
    </>
  );
}
