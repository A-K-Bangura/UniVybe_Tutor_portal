import { useQuery } from "@tanstack/react-query";
import { ErrorPanel } from "../../shared/ui/primitives";
import { str } from "../../shared/api/client";
import { institutions } from "./api";

export function AcademicContextFilters({
  values,
  onChange,
}: {
  values: Record<string, string>;
  onChange: (changes: Record<string, string>) => void;
}) {
  const university = values.university_id || "",
    faculty = values.faculty_id || "";
  const universities = useQuery({
    queryKey: ["lookup", "universities"],
    queryFn: ({ signal }) => institutions("universities", signal),
  });
  const faculties = useQuery({
    queryKey: ["lookup", "faculties", university],
    queryFn: ({ signal }) =>
      institutions(`universities/${university}/faculties`, signal),
    enabled: !!university,
  });
  const departments = useQuery({
    queryKey: ["lookup", "departments", university, faculty],
    queryFn: ({ signal }) =>
      institutions(
        `universities/${university}/faculties/${faculty}/departments`,
        signal,
      ),
    enabled: !!university && !!faculty,
  });
  return (
    <div className="toolbar">
      {(
        [
          ["university_id", "University", universities, true],
          ["faculty_id", "Faculty", faculties, !!university],
          [
            "department_id",
            "Department",
            departments,
            !!university && !!faculty,
          ],
        ] as const
      ).map(([name, title, query, eligible]) => (
        <label key={name}>
          {title}
          <select
            aria-label={`${title} filter`}
            disabled={!eligible || query.isPending || query.isError}
            value={values[name] || ""}
            onChange={(event) =>
              onChange({
                [name]: event.target.value,
                ...(name === "university_id"
                  ? { faculty_id: "", department_id: "" }
                  : name === "faculty_id"
                    ? { department_id: "" }
                    : {}),
                academic_module_id: "",
              })
            }
          >
            <option value="">All {title.toLowerCase()} options</option>
            {query.data?.map((item) => (
              <option key={str(item.id)} value={str(item.id)}>
                {str(item.name)}
              </option>
            ))}
          </select>
          {query.isError && (
            <ErrorPanel
              error={query.error}
              retry={() => void query.refetch()}
            />
          )}
        </label>
      ))}
    </div>
  );
}
