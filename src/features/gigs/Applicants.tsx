import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  object,
  page,
  request,
  str,
  type RecordData,
} from "../../shared/api/client";
import {
  Badge,
  DataView,
  ErrorPanel,
  Loading,
  Modal,
} from "../../shared/ui/primitives";
import { key } from "./api";
import { GigForm, Input, Select } from "./Form";
import { Pagination } from "./List";

export function Applicants({
  id,
  canRate,
  options,
}: {
  id: string;
  canRate: boolean;
  options: RecordData;
}) {
  const [params, setParams] = useState(new URLSearchParams());
  const [selected, setSelected] = useState<RecordData>();
  const [reviews, setReviews] = useState<RecordData>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const cache = useQueryClient();
  const q = useQuery({
    queryKey: ["gig-applicants", id, params.toString()],
    queryFn: async ({ signal }) =>
      page(
        await request(
          `tutor/gigs/${key(id)}/applicants?${params}`,
          "GET",
          undefined,
          signal,
        ),
      ),
  });
  async function refresh() {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["gig-applicants", id] }),
      cache.invalidateQueries({ queryKey: ["gig-reviews"] }),
      cache.invalidateQueries({ queryKey: ["gig", id] }),
      cache.invalidateQueries({ queryKey: ["gigs"] }),
    ]);
  }
  return (
    <section className="panel">
      <h2>Interested students</h2>
      <p>
        Worked With records your own experience with a student. It is not a
        payment or delivery check.
      </p>
      <form
        className="gig-filters"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget),
            next = new URLSearchParams();
          for (const [k, v] of data) if (str(v)) next.set(k, str(v));
          setParams(next);
        }}
      >
        <label>
          Student name
          <input name="search" />
        </label>
        <label>
          Worked With filter
          <select name="worked_with">
            <option value="">All interested students</option>
            <option value="true">Worked with</option>
            <option value="false">Not worked with</option>
          </select>
        </label>
        <button>Filter students</button>
      </form>
      {error !== undefined && (
        <ErrorPanel error={error} retry={() => void refresh()} />
      )}
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorPanel error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          {!q.data.items.length && (
            <p>No interested students match these filters.</p>
          )}
          {q.data.items.map((applicant) => {
            const student = object(applicant.student),
              rating = object(student.gig_rating),
              given = object(applicant.rating_given);
            return (
              <article className="gig-applicant" key={str(applicant.id)}>
                <div className="actions">
                  {!!student.avatar_url && (
                    <img
                      className="avatar"
                      src={str(student.avatar_url)}
                      alt=""
                    />
                  )}
                  <h3>{str(student.name)}</h3>
                  {applicant.worked_with === true && (
                    <Badge value="worked_with" />
                  )}
                </div>
                <p>{str(student.bio)}</p>
                <p>
                  {str(object(student.university).name)}
                  {student.level ? ` · Level ${str(student.level)}` : ""}
                </p>
                <DataView
                  value={{
                    faculty: student.faculty,
                    department: student.department,
                    organization: student.organization,
                    interests: student.interests,
                  }}
                />
                <p>
                  {rating.average_rating == null
                    ? "No gig ratings yet"
                    : `${str(rating.average_rating)} / 5 from ${str(rating.rating_count)} ratings`}
                </p>
                <p>Interested: {str(applicant.interested_at)}</p>
                {!!given.rating && (
                  <p>
                    Your rating: {str(given.rating)} / 5
                    {given.review ? ` — ${str(given.review)}` : ""}
                  </p>
                )}
                <div className="actions">
                  <button onClick={() => setReviews(student)}>
                    View student reviews
                  </button>
                  {canRate && (
                    <>
                      <button
                        disabled={
                          busy ||
                          (applicant.worked_with === true &&
                            !!(
                              applicant.rating_given ||
                              applicant.rating_received
                            ))
                        }
                        onClick={async () => {
                          setBusy(true);
                          setError(undefined);
                          try {
                            await request(
                              `tutor/gigs/${key(id)}/applicants/${key(applicant.id)}/worked-with`,
                              "PUT",
                              { worked_with: applicant.worked_with !== true },
                            );
                            await refresh();
                          } catch (err) {
                            setError(err);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {applicant.worked_with === true
                          ? "Undo Worked With"
                          : "Mark Worked With"}
                      </button>
                      {applicant.worked_with === true && (
                        <button
                          disabled={busy}
                          onClick={() => setSelected(applicant)}
                        >
                          {given.rating ? "Edit rating" : "Rate student"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </article>
            );
          })}
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
      {selected && (
        <Modal
          open
          title={`Rate ${str(object(selected.student).name)}`}
          onClose={() => setSelected(undefined)}
        >
          <GigForm
            initial={object(selected.rating_given)}
            button={selected.rating_given ? "Update rating" : "Save rating"}
            save={async (values) => {
              await request(
                `tutor/gigs/${key(id)}/applicants/${key(selected.id)}/rating`,
                "PUT",
                {
                  rating: Number(values.rating),
                  review: str(values.review).trim() || null,
                },
              );
              await refresh();
              setSelected(undefined);
            }}
          >
            {(values) => (
              <>
                <Select
                  name="rating"
                  title="Rating"
                  values={values}
                  required
                  options={[1, 2, 3, 4, 5].map((v) => ({
                    value: String(v),
                    label: `${v} ${v === 1 ? "star" : "stars"}`,
                  }))}
                />
                <Input
                  name="review"
                  title="Review"
                  values={values}
                  type="textarea"
                  maxLength={
                    Number(object(options.rating).review_max_length) || 2000
                  }
                />
                <p>
                  Saving again replaces your earlier rating for this student on
                  this gig.
                </p>
              </>
            )}
          </GigForm>
        </Modal>
      )}
      {reviews && (
        <Modal
          open
          title={`${str(reviews.name)} — gig reviews`}
          onClose={() => setReviews(undefined)}
        >
          <StudentReviews student={str(reviews.id)} />
        </Modal>
      )}
    </section>
  );
}
function StudentReviews({ student }: { student: string }) {
  const [index, setIndex] = useState(1);
  const q = useQuery({
    queryKey: ["gig-reviews", student, index],
    queryFn: async ({ signal }) => {
      const response = await request(
        `gigs/students/${key(student)}/reviews?page=${index}`,
        "GET",
        undefined,
        signal,
      );
      const data = object(response.data);
      return {
        rating: object(data.gig_rating),
        ...page({ data: data.reviews, meta: response.meta }),
      };
    },
  });
  if (q.isPending) return <Loading />;
  if (q.isError)
    return <ErrorPanel error={q.error} retry={() => void q.refetch()} />;
  return (
    <>
      <p>
        {q.data.rating.average_rating == null
          ? "No ratings yet"
          : `${str(q.data.rating.average_rating)} / 5 · ${str(q.data.rating.rating_count)} ratings`}
      </p>
      <DataView value={q.data.items} />
      <Pagination
        current={q.data.current}
        last={q.data.last}
        change={setIndex}
      />
    </>
  );
}
