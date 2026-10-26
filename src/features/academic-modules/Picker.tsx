import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { object, str, type RecordData } from "../../shared/api/client";
import { ErrorPanel } from "../../shared/ui/primitives";
import { moduleDetail, moduleLabel, modulesPage } from "./api";

export function AcademicModulePicker({
  id,
  value,
  onChange,
  faculty = "",
  department = "",
  university = "",
  current,
  admin = false,
  disabled = false,
  ariaLabel = "Academic module",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  faculty?: string;
  department?: string;
  university?: string;
  current?: unknown;
  admin?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [index, setIndex] = useState(1);
  const [selected, setSelected] = useState<RecordData>();
  const eligible = admin || !!faculty || !!department;
  const params = new URLSearchParams({ per_page: "15", page: String(index) });
  if (department) params.set("department_id", department);
  else if (faculty) params.set("faculty_id", faculty);
  else if (admin && university) params.set("university_id", university);
  if (applied) params.set("search", applied);
  const q = useQuery({
    queryKey: ["academic-module-options", admin, params.toString()],
    queryFn: ({ signal }) => modulesPage(params, admin, signal),
    enabled: eligible,
    refetchOnWindowFocus: false,
  });
  const detail = useQuery({
    queryKey: ["academic-module-choice", value],
    queryFn: ({ signal }) => moduleDetail(value, signal),
    enabled: admin && !!value,
    refetchOnWindowFocus: false,
  });
  const initial = object(current);
  const choice = [selected, initial, detail.data].find(
    (item) => item && str(item.id) === value,
  );
  const options = q.data?.items || [];
  const missing = value && !options.some((module) => str(module.id) === value);
  const apply = () => {
    setApplied(search.trim());
    setIndex(1);
  };
  return (
    <div className="academic-module-picker">
      <div className="actions">
        <input
          aria-label={`Find ${ariaLabel.toLowerCase()}`}
          placeholder="Search module code or title"
          value={search}
          maxLength={100}
          disabled={disabled || !eligible}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              apply();
            }
          }}
        />
        <button
          type="button"
          disabled={disabled || !eligible || q.isFetching}
          onClick={apply}
        >
          Find modules
        </button>
      </div>
      <select
        id={id}
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value;
          setSelected(options.find((module) => str(module.id) === next));
          onChange(next);
        }}
      >
        <option value="">
          {admin ? "All academic modules" : "No academic module"}
        </option>
        {missing && (
          <option value={value} disabled={choice?.is_active === false}>
            {choice
              ? `${moduleLabel(choice)}${choice.is_active === false ? " (retired)" : ""}`
              : "Selected academic module (unavailable)"}
          </option>
        )}
        {(["faculty", "department"] as const).map((scope) => (
          <optgroup
            key={scope}
            label={
              scope === "faculty" ? "Faculty modules" : "Department modules"
            }
          >
            {options
              .filter((module) => module.scope === scope)
              .map((module) => (
                <option
                  key={str(module.id)}
                  value={str(module.id)}
                  disabled={!admin && module.is_active === false}
                >
                  {moduleLabel(module)}
                  {module.is_active === false ? " (retired)" : ""}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      {!eligible ? (
        <small>
          Choose a faculty or department first. A university alone does not
          identify a course module.
        </small>
      ) : q.isFetching ? (
        <small role="status">Loading academic modules…</small>
      ) : q.data?.total === 0 ? (
        <small>
          No matching academic modules. A course can be saved without one.
        </small>
      ) : null}
      {!admin && choice?.is_active === false && (
        <p className="notice">
          This module is retired. You can keep it on this course or choose an
          active replacement.
        </p>
      )}
      {q.isError && (
        <ErrorPanel error={q.error} retry={() => void q.refetch()} />
      )}
      {detail.isError && (
        <ErrorPanel error={detail.error} retry={() => void detail.refetch()} />
      )}
      {q.data && q.data.last > 1 && (
        <div className="actions">
          <button
            type="button"
            disabled={disabled || q.isFetching || q.data.current <= 1}
            onClick={() => setIndex(index - 1)}
          >
            Previous modules
          </button>
          <span>
            Module page {q.data.current} of {q.data.last}
          </span>
          <button
            type="button"
            disabled={disabled || q.isFetching || q.data.current >= q.data.last}
            onClick={() => setIndex(index + 1)}
          >
            Next modules
          </button>
        </div>
      )}
    </div>
  );
}
