import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { gigCategories, gigList, statuses } from "./api";
import { object, str } from "../../shared/api/client";
import { Badge, ErrorPanel, Header, Loading } from "../../shared/ui/primitives";

export default function GigsList({ admin = false }: { admin?: boolean }) {
  const [params, setParams] = useSearchParams();
  const query = new URLSearchParams(params);
  if (admin && !query.has("status")) query.set("status", "pending_approval");
  if (query.get("status") === "all") query.delete("status");
  query.set("per_page", "15");
  const q = useQuery({
    queryKey: ["gigs", admin, query.toString()],
    queryFn: ({ signal }) => gigList(query, admin, signal),
  });
  const categories = useQuery({
    queryKey: ["gig-categories", admin],
    queryFn: ({ signal }) => gigCategories(admin, signal),
  });
  function filters(form: HTMLFormElement) {
    const next = new URLSearchParams();
    for (const [name, value] of new FormData(form))
      if (String(value).trim()) next.set(name, String(value).trim());
    // IDs belong to separate creator tables; never send one without its type.
    if (!next.get("creator_type")) next.delete("creator_id");
    setParams(next);
  }
  return (
    <>
      <Header
        title={admin ? "Gig review queue" : "My gigs"}
        subtitle={
          admin
            ? "Every gig needs approval, including your own. Review pending submissions or filter all gigs."
            : "Post small jobs for students. Conversation and payment happen outside UniVybe."
        }
      >
        <Link className="button primary" to="/gigs/new">
          Create gig
        </Link>
        {admin && (
          <Link className="button" to="/gig-categories">
            Manage categories
          </Link>
        )}
      </Header>
      <form
        className="panel gig-filters"
        key={params.toString()}
        onSubmit={(e) => {
          e.preventDefault();
          filters(e.currentTarget);
        }}
      >
        <label>
          Search
          <input name="search" defaultValue={params.get("search") || ""} />
        </label>
        <label>
          Status
          <select
            name="status"
            aria-label="Status"
            defaultValue={
              params.get("status") || (admin ? "pending_approval" : "all")
            }
          >
            <option value="all">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select
            name="category_id"
            aria-label="Category"
            defaultValue={params.get("category_id") || ""}
          >
            <option value="">All categories</option>
            {categories.data?.map((c) => (
              <option key={str(c.id)} value={str(c.id)}>
                {str(c.name)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Work mode
          <select
            name="work_mode"
            aria-label="Work mode"
            defaultValue={params.get("work_mode") || ""}
          >
            <option value="">All work modes</option>
            {["remote", "physical", "hybrid"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Pricing
          <select
            name="pricing_type"
            aria-label="Pricing"
            defaultValue={params.get("pricing_type") || ""}
          >
            <option value="">All pricing</option>
            <option>fixed</option>
            <option>negotiable</option>
          </select>
        </label>
        {admin && (
          <>
            <label>
              Creator type
              <select
                name="creator_type"
                aria-label="Creator type"
                defaultValue={params.get("creator_type") || ""}
              >
                <option value="">All creators</option>
                <option value="student">Student</option>
                <option value="creation_user">Creation user</option>
              </select>
            </label>
            <label>
              Creator ID
              <input
                name="creator_id"
                aria-label="Creator ID"
                type="number"
                min="1"
                defaultValue={params.get("creator_id") || ""}
              />
              <small>Select a creator type when filtering by ID.</small>
            </label>
            <label>
              Deleted records
              <select
                name="trashed"
                aria-label="Deleted records"
                defaultValue={params.get("trashed") || ""}
              >
                <option value="">Exclude deleted</option>
                <option value="with">Include deleted</option>
                <option value="only">Deleted only</option>
              </select>
            </label>
          </>
        )}
        <button type="submit">Apply filters</button>
      </form>
      {categories.isError && (
        <ErrorPanel
          error={categories.error}
          retry={() => void categories.refetch()}
        />
      )}
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorPanel error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          <p className="muted">{q.data.total} gigs</p>
          {!q.data.items.length && (
            <div className="panel">No gigs match these filters.</div>
          )}
          <div className="gig-list">
            {q.data.items.map((gig) => (
              <article className="panel" key={str(gig.id)}>
                <div className="actions">
                  <Badge value={gig.status} />
                  {!!gig.deleted_at && <Badge value="deleted" />}
                </div>
                <h2>
                  <Link
                    to={`${admin ? "/reviews/gigs" : "/gigs"}/${str(gig.uuid || gig.id)}`}
                  >
                    {str(gig.title)}
                  </Link>
                </h2>
                <p>{str(gig.short_description)}</p>
                <p>
                  {str(object(gig.category).name)} · {str(gig.price_label)} ·{" "}
                  {str(gig.work_mode_label || gig.work_mode)}
                </p>
                <p>
                  {str(gig.applicant_count)} interested ·{" "}
                  {gig.spots_remaining == null
                    ? "No capacity limit"
                    : `${str(gig.spots_remaining)} spots remaining`}
                </p>
                <p>
                  {gig.is_accepting_interest
                    ? "Accepting interest"
                    : `Not accepting interest${gig.closed_reason ? ` · ${str(gig.closed_reason).replaceAll("_", " ")}` : ""}`}
                </p>
                {!!gig.rejection_reason && (
                  <p className="error">
                    Needs changes: {str(gig.rejection_reason)}
                  </p>
                )}
                {admin && (
                  <p>
                    Posted by {str(object(gig.creator).name)} ·{" "}
                    {str(gig.creator_type).replaceAll("_", " ")}
                    {gig.creator_in_good_standing === false &&
                      " · Account is not in good standing"}
                  </p>
                )}
              </article>
            ))}
          </div>
          <Pagination
            current={q.data.current}
            last={q.data.last}
            change={(page) => {
              const next = new URLSearchParams(params);
              next.set("page", String(page));
              setParams(next);
            }}
          />
        </>
      )}
    </>
  );
}
export function Pagination({
  current,
  last,
  change,
}: {
  current: number;
  last: number;
  change: (page: number) => void;
}) {
  return (
    <nav className="actions" aria-label="Pagination">
      <button disabled={current <= 1} onClick={() => change(current - 1)}>
        Previous
      </button>
      <span>
        Page {current} of {last}
      </span>
      <button disabled={current >= last} onClick={() => change(current + 1)}>
        Next
      </button>
    </nav>
  );
}
