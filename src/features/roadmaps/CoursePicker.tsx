import { useState } from "react";
import { CourseFilters } from "./CourseFilters";
import { emptyCourseFilters } from "./course-filter-values";
import { request, page, str, type RecordData } from "../../shared/api/client";
import { Badge, ErrorPanel, Loading } from "../../shared/ui/primitives";
import { levelLabel } from "../courses/levels";
import { AcademicModuleSummary } from "../academic-modules/Summary";
export function CoursePicker({
  selected,
  onChange,
  existing = [],
  disabled = false,
}: {
  selected: RecordData[];
  onChange: (courses: RecordData[]) => void;
  existing?: number[];
  disabled?: boolean;
}) {
  const [filters, setFilters] = useState(emptyCourseFilters);
  const [applied, setApplied] = useState<typeof filters>();
  const [results, setResults] = useState<ReturnType<typeof page>>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const hasFilters = Object.values(filters).some(
    (value) => value.trim() !== "",
  );
  async function fetchCourses(index = 1, criteria = filters) {
    if (!Object.values(criteria).some((value) => value.trim())) return;
    setBusy(true);
    setError(undefined);
    setResults(undefined);
    try {
      const params = new URLSearchParams({
        page: String(index),
        per_page: "15",
      });
      for (const [key, value] of Object.entries(criteria))
        if (value.trim()) params.set(key, value.trim());
      const result = page(await request(`admin/courses?${params}`));
      setResults(result);
      setApplied({ ...criteria });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="form-section" aria-label="Course selection">
      <h3>Choose courses</h3>
      <p>
        Set at least one filter, then fetch matching courses. Changing filters
        does not send a request.
      </p>
      <CourseFilters
        values={filters}
        onChange={setFilters}
        disabled={disabled || busy}
      />
      <button
        type="button"
        className="primary"
        disabled={!hasFilters || busy || disabled}
        onClick={() => void fetchCourses()}
      >
        Fetch courses
      </button>
      {busy && <Loading />}
      {error !== undefined && <ErrorPanel error={error} />}
      {results && (
        <>
          <p>
            {results.total} matching courses. Results use the last fetched
            filters.
          </p>
          {results.items.length === 0 && (
            <p>No matching courses. Adjust the filters and fetch again.</p>
          )}
          {results.items.map((course) => {
            const id = Number(course.id),
              added = existing.includes(id),
              checked = selected.some((s) => Number(s.id) === id);
            return (
              <label className="sequence-row" key={id}>
                <input
                  type="checkbox"
                  aria-label={`Select ${str(course.title)}`}
                  checked={added || checked}
                  disabled={disabled || added || !Number.isInteger(id)}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...selected, course]
                        : selected.filter((s) => Number(s.id) !== id),
                    )
                  }
                />
                <strong>{str(course.title)}</strong>
                <Badge value={course.status} />
                <Badge value={levelLabel(course.level)} />
                <AcademicModuleSummary value={course.academic_module} />
                {added && <small>Already included</small>}
              </label>
            );
          })}
          <div className="pagination">
            <button
              type="button"
              disabled={busy || results.current <= 1}
              onClick={() => void fetchCourses(results.current - 1, applied)}
            >
              Previous courses
            </button>
            <span>
              Page {results.current} of {results.last}
            </span>
            <button
              type="button"
              disabled={busy || results.current >= results.last}
              onClick={() => void fetchCourses(results.current + 1, applied)}
            >
              Next courses
            </button>
          </div>
        </>
      )}
      <p role="status">{selected.length} courses selected</p>
      {selected.map((course, index) => (
        <div className="sequence-row" key={str(course.id)}>
          <span>
            {index + 1}. {str(course.title)}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(selected.filter((s) => s.id !== course.id))}
          >
            Deselect {str(course.title)}
          </button>
        </div>
      ))}
    </section>
  );
}
