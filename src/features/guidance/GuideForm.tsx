import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ApiError,
  object,
  request,
  rows,
  str,
  type RecordData,
} from "../../shared/api/client";
import { ErrorPanel, Loading } from "../../shared/ui/primitives";
import { GuidanceForm, Input } from "./Form";
import { guideDefaults, guidePath, guidePayload, lookup } from "./api";

function Place({ add }: { add: (value: RecordData) => void }) {
  const [scope, setScope] = useState("university");
  const [university, setUniversity] = useState("");
  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState("");
  const universities = useQuery({
    queryKey: ["guidance-lookup", "universities"],
    queryFn: ({ signal }) => lookup("universities", signal),
  });
  const faculties = useQuery({
    queryKey: ["guidance-lookup", university],
    queryFn: ({ signal }) =>
      lookup(`universities/${university}/faculties`, signal),
    enabled: !!university,
  });
  const departments = useQuery({
    queryKey: ["guidance-lookup", university, faculty],
    queryFn: ({ signal }) =>
      lookup(
        `universities/${university}/faculties/${faculty}/departments`,
        signal,
      ),
    enabled: !!university && !!faculty,
  });
  return (
    <fieldset className="guidance-place-picker">
      <legend>Add a place</legend>
      <label>
        Coverage scope
        <select value={scope} onChange={(e) => setScope(e.target.value)}>
          {["university", "faculty", "department", "platform"].map((s) => (
            <option key={s} value={s}>
              {s === "platform" ? "All universities" : s}
            </option>
          ))}
        </select>
      </label>
      {scope !== "platform" && (
        <>
          <label>
            University
            <select
              value={university}
              onChange={(e) => {
                setUniversity(e.target.value);
                setFaculty("");
                setDepartment("");
              }}
            >
              <option value="">Select university</option>
              {universities.data?.map((r) => (
                <option key={str(r.id)} value={str(r.id)}>
                  {str(r.name)}
                </option>
              ))}
            </select>
          </label>
          {scope !== "university" && (
            <label>
              Faculty
              <select
                value={faculty}
                onChange={(e) => {
                  setFaculty(e.target.value);
                  setDepartment("");
                }}
              >
                <option value="">Select faculty</option>
                {faculties.data?.map((r) => (
                  <option key={str(r.id)} value={str(r.id)}>
                    {str(r.name)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {scope === "department" && (
            <label>
              Department
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">Select department</option>
                {departments.data?.map((r) => (
                  <option key={str(r.id)} value={str(r.id)}>
                    {str(r.name)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {[universities, faculties, departments].map((q, i) =>
            q.isError ? (
              <ErrorPanel
                key={i}
                error={q.error}
                retry={() => void q.refetch()}
              />
            ) : null,
          )}
        </>
      )}
      <button
        type="button"
        disabled={
          scope !== "platform" &&
          (!university ||
            (scope !== "university" && !faculty) ||
            (scope === "department" && !department))
        }
        onClick={() =>
          add(
            scope === "platform"
              ? { scope, label: "All universities" }
              : {
                  scope,
                  university_id: Number(university),
                  ...(scope !== "university"
                    ? { faculty_id: Number(faculty) }
                    : {}),
                  ...(scope === "department"
                    ? { department_id: Number(department) }
                    : {}),
                  label: [
                    universities.data?.find((r) => str(r.id) === university)
                      ?.name,
                    scope !== "university" &&
                      faculties.data?.find((r) => str(r.id) === faculty)?.name,
                    scope === "department" &&
                      departments.data?.find((r) => str(r.id) === department)
                        ?.name,
                  ]
                    .filter(Boolean)
                    .join(" > "),
                },
          )
        }
      >
        Add place
      </button>
    </fieldset>
  );
}
export default function GuideForm({
  guide,
  save,
}: {
  guide: RecordData;
  save: (body: RecordData) => Promise<void>;
}) {
  const initial = guideDefaults(guide);
  const [coverage, setCoverage] = useState(rows(initial.coverage));
  const [categories, setCategories] = useState(
    initial.category_ids as number[],
  );
  const options = useQuery({
    queryKey: ["guidance", "options"],
    queryFn: async ({ signal }) =>
      object(
        (await request(`${guidePath}/options`, "GET", undefined, signal)).data,
      ),
  });
  if (options.isPending) return <Loading />;
  if (options.isError)
    return (
      <ErrorPanel error={options.error} retry={() => void options.refetch()} />
    );
  const available = rows(options.data.categories);
  const missing = rows(
    object(guide.pending_changes).categories ?? guide.categories,
  ).filter((c) => !available.some((a) => a.id === c.id));
  return (
    <GuidanceForm
      initial={initial}
      extraDirty={
        JSON.stringify(coverage) !== JSON.stringify(initial.coverage) ||
        JSON.stringify(categories) !== JSON.stringify(initial.category_ids)
      }
      protect
      button={
        guide.id
          ? guide.approval_status === "rejected"
            ? "Resubmit guide"
            : "Save guide"
          : "Submit guide"
      }
      save={async (values) => {
        if (!categories.length || !coverage.length)
          throw new ApiError(
            "Choose at least one category and add at least one place.",
          );
        await save(
          guidePayload(
            { ...values, category_ids: categories, coverage },
            initial,
            !guide.id,
          ),
        );
      }}
    >
      {(values) => (
        <>
          <section className="guidance-section">
            <h2>Contact details</h2>
            <p className="guidance-help">
              Add the person students can contact for guidance.
            </p>
            <div className="guidance-contact-grid">
              <Input
                name="name"
                title="Guide name"
                required
                maxLength={120}
                values={values}
              />
              <Input
                name="whatsapp_number"
                title="WhatsApp number"
                type="tel"
                placeholder="e.g. 23280334477"
                required
                maxLength={30}
                values={values}
                help="Include the country code, for example 23280334477."
              />
            </div>
            <Input
              name="description"
              title="Private reviewer note"
              type="textarea"
              maxLength={1000}
              values={values}
              help="Optional. Only reviewing admins can see this note."
            />
          </section>
          <fieldset className="guidance-section">
            <legend>Question categories</legend>
            <p className="guidance-help">
              Select the topics this person can help with.
            </p>
            <div className="guidance-category-grid">
              {[...available, ...missing].map((c) => (
                <label key={str(c.id)}>
                  <input
                    type="checkbox"
                    checked={categories.includes(Number(c.id))}
                    onChange={(e) =>
                      setCategories(
                        e.target.checked
                          ? [...categories, Number(c.id)]
                          : categories.filter((id) => id !== Number(c.id)),
                      )
                    }
                  />
                  {str(c.name)}
                  {missing.includes(c)
                    ? " (unavailable for new selection)"
                    : ""}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="guidance-section">
            <legend>Places this guide supports</legend>
            <p className="guidance-help">
              Add one or more places, or choose all universities for general
              guidance.
            </p>
            {coverage.map((place, i) => (
              <p className="guidance-coverage-item" key={i}>
                {str(place.label)}
                {place.is_valid === false
                  ? " — inactive or removed; replace this place"
                  : ""}{" "}
                <button
                  type="button"
                  onClick={() =>
                    setCoverage(coverage.filter((_, n) => n !== i))
                  }
                >
                  Remove place {i + 1}
                </button>
              </p>
            ))}
            {coverage.length <
              Number(options.data.max_coverage_per_guide || 30) && (
              <Place add={(place) => setCoverage([...coverage, place])} />
            )}
          </fieldset>
          <div className="guidance-consent">
            <label>
              <input
                type="checkbox"
                name="consent_confirmed"
                required={
                  !guide.id ||
                  str(values.whatsapp_number) !== str(initial.whatsapp_number)
                }
              />
              This person agreed to have their WhatsApp number shared with
              students they are matched with.
            </label>
            <p className="guidance-help">
              New guides require admin approval. For approved guides, changes to
              contact details, categories and places await review; the private
              note changes immediately. Admin edits apply immediately.
            </p>
          </div>
        </>
      )}
    </GuidanceForm>
  );
}
