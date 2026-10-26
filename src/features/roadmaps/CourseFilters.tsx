import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { page, request, str, type RecordData } from "../../shared/api/client";
import { ErrorPanel } from "../../shared/ui/primitives";

import type { CourseFilterValues } from "./course-filter-values";
import { contentLevelOptions } from "../courses/levels";
import { AcademicModulePicker } from "../academic-modules/Picker";

async function institutions(path: string, signal: AbortSignal) {
  const items: RecordData[] = [];
  let last = 1;
  for (let index = 1; index <= last; index++) {
    const result = page(
      await request(
        `${path}?per_page=50&page=${index}`,
        "GET",
        undefined,
        signal,
        true,
      ),
    );
    items.push(...result.items);
    last = result.last;
  }
  return items;
}

export function CourseFilters({
  values,
  onChange,
  disabled,
}: {
  values: CourseFilterValues;
  onChange: (values: CourseFilterValues) => void;
  disabled: boolean;
}) {
  const [creatorSearch, setCreatorSearch] = useState("");
  const [creatorRequest, setCreatorRequest] = useState<{
    search: string;
    index: number;
  }>();
  const universities = useQuery({
    queryKey: ["lookup", "universities"],
    queryFn: ({ signal }) => institutions("universities", signal),
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });
  const organizations = useQuery({
    queryKey: ["lookup", "organizations"],
    queryFn: ({ signal }) => institutions("organizations", signal),
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });
  const faculties = useQuery({
    queryKey: ["lookup", "faculties", values.university_id],
    queryFn: ({ signal }) =>
      institutions(`universities/${values.university_id}/faculties`, signal),
    enabled: !!values.university_id,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });
  const departments = useQuery({
    queryKey: [
      "lookup",
      "departments",
      values.university_id,
      values.faculty_id,
    ],
    queryFn: ({ signal }) =>
      institutions(
        `universities/${values.university_id}/faculties/${values.faculty_id}/departments`,
        signal,
      ),
    enabled: !!values.university_id && !!values.faculty_id,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });
  const creators = useQuery({
    queryKey: ["roadmap-course-creators", creatorRequest],
    queryFn: async ({ signal }) =>
      page(
        await request(
          `admin/users?${new URLSearchParams({ search: creatorRequest!.search, user_type: "creation_user", per_page: "15", page: String(creatorRequest!.index) })}`,
          "GET",
          undefined,
          signal,
        ),
      ),
    enabled: !!creatorRequest,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });
  const set = (key: keyof CourseFilterValues, value: string) =>
    onChange({
      ...values,
      [key]: value,
      ...(["university_id", "faculty_id", "department_id"].includes(key)
        ? { academic_module_id: "" }
        : {}),
      ...(key === "university_id"
        ? { faculty_id: "", department_id: "" }
        : key === "faculty_id"
          ? { department_id: "" }
          : {}),
    });
  return (
    <>
      <div className="form-grid">
        <label>
          Organization
          <select
            aria-label="Course organization filter"
            disabled={
              disabled || organizations.isPending || !!organizations.error
            }
            value={values.organization_id}
            onChange={(e) => set("organization_id", e.target.value)}
          >
            <option value="">
              {organizations.isFetching ? "Loading…" : "Any organization"}
            </option>
            {organizations.data?.map((item) => (
              <option key={str(item.id)} value={str(item.id)}>
                {str(item.name)}
              </option>
            ))}
          </select>
          {organizations.error && (
            <ErrorPanel
              error={organizations.error}
              retry={() => void organizations.refetch()}
            />
          )}
        </label>
        <label>
          Semester (exact match)
          <input
            aria-label="Course semester filter"
            disabled={disabled}
            maxLength={50}
            value={values.semester}
            onChange={(e) => set("semester", e.target.value)}
            placeholder="e.g. First Semester"
          />
        </label>
        <label>
          Course title or description
          <input
            aria-label="Course search filter"
            disabled={disabled}
            value={values.search}
            onChange={(e) => set("search", e.target.value)}
          />
        </label>
        <label>
          Course status
          <select
            aria-label="Course status filter"
            disabled={disabled}
            value={values.status}
            onChange={(e) => set("status", e.target.value)}
          >
            <option value="">Any status</option>
            {[
              "draft",
              "pending_approval",
              "published",
              "rejected",
              "archived",
            ].map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Academic level
          <select
            aria-label="Course level filter"
            disabled={disabled}
            value={values.level}
            onChange={(e) => set("level", e.target.value)}
          >
            <option value="">Any level</option>
            {contentLevelOptions.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {(
          [
            ["university_id", "University", universities, true],
            ["faculty_id", "Faculty", faculties, !!values.university_id],
            ["department_id", "Department", departments, !!values.faculty_id],
          ] as const
        ).map(([key, label, query, eligible]) => (
          <label key={key}>
            {label}
            <select
              aria-label={`Course ${label.toLowerCase()} filter`}
              disabled={
                disabled || !eligible || query.isPending || !!query.error
              }
              value={values[key]}
              onChange={(e) => set(key, e.target.value)}
            >
              <option value="">
                {eligible
                  ? query.isFetching
                    ? "Loading…"
                    : `Any ${label.toLowerCase()}`
                  : key === "faculty_id"
                    ? "Select a university first"
                    : "Select a faculty first"}
              </option>
              {query.data?.map((item) => (
                <option key={str(item.id)} value={str(item.id)}>
                  {str(item.name)}
                </option>
              ))}
            </select>
            {query.error && (
              <ErrorPanel
                error={query.error}
                retry={() => void query.refetch()}
              />
            )}
          </label>
        ))}
        <div>
          <label htmlFor="picker-academic-module">Academic module</label>
          <AcademicModulePicker
            key={`${values.university_id}:${values.faculty_id}:${values.department_id}`}
            id="picker-academic-module"
            ariaLabel="Course academic module filter"
            admin
            university={values.university_id}
            faculty={values.faculty_id}
            department={values.department_id}
            disabled={disabled}
            value={values.academic_module_id}
            onChange={(value) => set("academic_module_id", value)}
          />
        </div>
        <label>
          Find a course creator
          <input
            aria-label="Course creator search"
            disabled={disabled}
            value={creatorSearch}
            onChange={(e) => setCreatorSearch(e.target.value)}
            placeholder="Name or email"
          />
        </label>
        <div>
          <button
            type="button"
            disabled={disabled || !creatorSearch.trim() || creators.isFetching}
            onClick={() =>
              setCreatorRequest({ search: creatorSearch.trim(), index: 1 })
            }
          >
            Find creators
          </button>
        </div>
        <label>
          Course creator
          <select
            aria-label="Course creator filter"
            disabled={disabled || creators.isFetching}
            value={values.created_by}
            onChange={(e) => set("created_by", e.target.value)}
          >
            <option value="">Any creator</option>
            {values.created_by &&
              !creators.data?.items.some(
                (item) => str(item.id) === values.created_by,
              ) && (
                <option value={values.created_by}>
                  Selected creator #{values.created_by}
                </option>
              )}
            {creators.data?.items.map((item) => (
              <option key={str(item.id)} value={str(item.id)}>
                {str(item.full_name) ||
                  `${str(item.firstname)} ${str(item.lastname)}`}{" "}
                · {str(item.email)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {creators.error && (
        <ErrorPanel
          error={creators.error}
          retry={() => void creators.refetch()}
        />
      )}
      {creators.data && (
        <div className="pagination">
          <button
            type="button"
            disabled={
              disabled || creators.isFetching || creators.data.current <= 1
            }
            onClick={() =>
              setCreatorRequest({
                ...creatorRequest!,
                index: creators.data!.current - 1,
              })
            }
          >
            Previous creators
          </button>
          <span>
            {creators.data.total === 0
              ? "No matching creators"
              : `Creator page ${creators.data.current} of ${creators.data.last}`}
          </span>
          <button
            type="button"
            disabled={
              disabled ||
              creators.isFetching ||
              creators.data.current >= creators.data.last
            }
            onClick={() =>
              setCreatorRequest({
                ...creatorRequest!,
                index: creators.data!.current + 1,
              })
            }
          >
            Next creators
          </button>
        </div>
      )}
      <p className="muted">
        Institution and organization options are cached; creator searches run
        only when you click Find creators.
      </p>
    </>
  );
}
