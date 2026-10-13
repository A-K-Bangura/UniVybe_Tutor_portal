import { page, request, type RecordData } from "../../shared/api/client";

export const initialResourceFilters = {
  search: "",
  resource_type: "",
  source_type: "",
  format: "",
  subject: "",
  module: "",
  tags: "",
  university_id: "",
  faculty_id: "",
  department_id: "",
  organization_id: "",
  level: "",
  semester: "",
  publication_year: "",
  course_id: "",
  sort: "newest",
};
export type ResourceFiltersValue = typeof initialResourceFilters;
export function hasResourceFilters(filters: ResourceFiltersValue) {
  return Object.entries(filters).some(
    ([key, value]) =>
      key !== "sort" &&
      (key === "tags"
        ? value.split(",").some((tag) => !!tag.trim())
        : !!value.trim()),
  );
}
export async function resourceLookup(path: string, signal: AbortSignal) {
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
