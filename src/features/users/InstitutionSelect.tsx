import { useQuery } from "@tanstack/react-query";
import { institutions } from "../academic-modules/api";
import { str } from "../../shared/api/client";
import { ErrorPanel } from "../../shared/ui/primitives";
export function InstitutionSelect({
  value,
  onChange,
  title = "Organization",
  kind = "organizations",
}: {
  value: string;
  onChange: (value: string) => void;
  title?: string;
  kind?: string;
}) {
  const q = useQuery({
    queryKey: ["lookup", kind],
    queryFn: ({ signal }) => institutions(kind, signal),
  });
  return (
    <label>
      {title}
      <select
        aria-label={`${title} filter`}
        value={value}
        disabled={q.isPending || q.isError}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All / not set</option>
        {q.data?.map((r) => (
          <option key={str(r.id)} value={str(r.id)}>
            {str(r.name)}
          </option>
        ))}
      </select>
      {q.isError && (
        <ErrorPanel error={q.error} retry={() => void q.refetch()} />
      )}
    </label>
  );
}
