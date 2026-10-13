import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { object, rows, str, request } from "../../shared/api/client";
import { ErrorPanel } from "../../shared/ui/primitives";
import { resourceLookup, type ResourceFiltersValue } from "./discovery";

export function DiscoveryFilters({
  values,
  onChange,
  disabled,
}: {
  values: ResourceFiltersValue;
  onChange: (value: ResourceFiltersValue) => void;
  disabled: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const types = useQuery({
    queryKey: ["resource-discovery-types"],
    queryFn: async ({ signal }) =>
      object(
        (await request("resources/types", "GET", undefined, signal, true)).data,
      ),
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });
  const universities = useQuery({
    queryKey: ["lookup", "universities"],
    queryFn: ({ signal }) => resourceLookup("universities", signal),
    enabled: expanded,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });
  const organizations = useQuery({
    queryKey: ["lookup", "organizations"],
    queryFn: ({ signal }) => resourceLookup("organizations", signal),
    enabled: expanded,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });
  const faculties = useQuery({
    queryKey: ["lookup", "faculties", values.university_id],
    queryFn: ({ signal }) =>
      resourceLookup(`universities/${values.university_id}/faculties`, signal),
    enabled: expanded && !!values.university_id,
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
      resourceLookup(
        `universities/${values.university_id}/faculties/${values.faculty_id}/departments`,
        signal,
      ),
    enabled: expanded && !!values.faculty_id,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });
  const set = (key: keyof ResourceFiltersValue, value: string) =>
    onChange({
      ...values,
      [key]: value,
      ...(key === "university_id"
        ? { faculty_id: "", department_id: "" }
        : key === "faculty_id"
          ? { department_id: "" }
          : key === "source_type"
            ? { format: "" }
            : {}),
    });
  const formats = [
    ...(values.source_type !== "external"
      ? rows(types.data?.file_formats)
      : []),
    ...(values.source_type !== "file" ? rows(types.data?.link_types) : []),
  ];
  return (
    <>
      <div className="form-grid">
        <label>
          Search resource library
          <input
            aria-label="Find approved resources"
            maxLength={100}
            disabled={disabled}
            value={values.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Title, description, author or source"
          />
        </label>
        {(
          [
            [
              "resource_type",
              "Resource type",
              rows(types.data?.resource_types),
            ],
            ["source_type", "File or link", rows(types.data?.source_types)],
            ["format", "Format or link type", formats],
          ] as const
        ).map(([key, name, options]) => (
          <label key={key}>
            {name}
            <select
              aria-label={`Resource ${key} filter`}
              disabled={disabled || types.isPending || !!types.error}
              value={values[key]}
              onChange={(e) => set(key, e.target.value)}
            >
              <option value="">{types.isFetching ? "Loading…" : "Any"}</option>
              {options.map((item) => (
                <option key={str(item.value)} value={str(item.value)}>
                  {str(item.label || item.value)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {types.error && (
        <ErrorPanel error={types.error} retry={() => void types.refetch()} />
      )}
      <details onToggle={(e) => setExpanded(e.currentTarget.open)}>
        <summary>More resource filters</summary>
        <div className="form-grid">
          {(
            [
              ["subject", "Subject", 150],
              ["module", "Module", 150],
              ["tags", "Tags (comma separated; all must match)", undefined],
              ["semester", "Semester (exact match)", 50],
            ] as const
          ).map(([key, name, max]) => (
            <label key={key}>
              {name}
              <input
                aria-label={`Resource ${key} filter`}
                disabled={disabled}
                value={values[key]}
                maxLength={max}
                onChange={(e) => set(key, e.target.value)}
              />
            </label>
          ))}
          {(
            [
              ["university_id", "University", universities, true],
              ["faculty_id", "Faculty", faculties, !!values.university_id],
              ["department_id", "Department", departments, !!values.faculty_id],
              ["organization_id", "Organization", organizations, true],
            ] as const
          ).map(([key, name, query, eligible]) => (
            <label key={key}>
              {name}
              <select
                aria-label={`Resource ${key} filter`}
                disabled={
                  disabled || !eligible || query.isPending || !!query.error
                }
                value={values[key]}
                onChange={(e) => set(key, e.target.value)}
              >
                <option value="">
                  {!eligible
                    ? key === "faculty_id"
                      ? "Select university first"
                      : "Select faculty first"
                    : query.isFetching
                      ? "Loading…"
                      : `Any ${name.toLowerCase()}`}
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
          <label>
            Academic level
            <select
              aria-label="Resource level filter"
              disabled={disabled}
              value={values.level}
              onChange={(e) => set("level", e.target.value)}
            >
              <option value="">Any level</option>
              {["UnderGrad", "100", "200", "300", "400", "500", "graduate"].map(
                (s) => (
                  <option key={s}>{s}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Publication year
            <input
              aria-label="Resource publication_year filter"
              type="number"
              step={1}
              disabled={disabled}
              value={values.publication_year}
              onChange={(e) => set("publication_year", e.target.value)}
            />
          </label>
          <label>
            Already attached to published course ID
            <input
              aria-label="Resource course_id filter"
              type="number"
              min={1}
              step={1}
              disabled={disabled}
              value={values.course_id}
              onChange={(e) => set("course_id", e.target.value)}
            />
            <small>Optional. This filter only matches published courses.</small>
          </label>
          <label>
            Sort results
            <select
              aria-label="Resource sort"
              disabled={disabled}
              value={values.sort}
              onChange={(e) => set("sort", e.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="title">Title</option>
            </select>
          </label>
        </div>
      </details>
    </>
  );
}
