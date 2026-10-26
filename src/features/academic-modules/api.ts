import { z } from "zod";
import {
  entity,
  object,
  page,
  request,
  str,
  type RecordData,
} from "../../shared/api/client";

const institution = z
  .object({ id: z.number(), name: z.string() })
  .passthrough();
export const academicModuleSchema = z
  .object({
    id: z.number(),
    code: z.string(),
    title: z.string(),
    label: z.string(),
    scope: z.enum(["faculty", "department"]),
    is_active: z.boolean(),
    university: institution,
    faculty: institution,
    department: institution.nullable(),
  })
  .passthrough();
export function moduleRecord(value: RecordData) {
  if (!academicModuleSchema.safeParse(value).success)
    throw new Error(
      "Unexpected academic module response. Refresh before continuing.",
    );
  return value;
}
export async function modulesPage(
  params: URLSearchParams,
  admin = false,
  signal?: AbortSignal,
) {
  if (
    !admin &&
    !["university_id", "faculty_id", "department_id"].some((key) =>
      params.get(key),
    )
  )
    throw new Error("Choose an academic context before finding modules.");
  const result = page(
    await request(
      `${admin ? "admin/" : ""}academic-modules?${params}`,
      "GET",
      undefined,
      signal,
      !admin,
    ),
  );
  return { ...result, items: result.items.map(moduleRecord) };
}
export async function moduleDetail(id: string, signal?: AbortSignal) {
  return moduleRecord(
    entity(
      await request(
        `admin/academic-modules/${encodeURIComponent(id)}`,
        "GET",
        undefined,
        signal,
      ),
      "academic_module",
    ),
  );
}
export const moduleLabel = (value: unknown) => {
  const module = object(value);
  return (
    str(module.label) ||
    [str(module.code), str(module.title)].filter(Boolean).join(" — ")
  );
};
export function moduleDefaults(module: RecordData): RecordData {
  return {
    ...module,
    scope: module.scope || "faculty",
    university_id: str(object(module.university).id || module.university_id),
    faculty_id: str(object(module.faculty).id || module.faculty_id),
    department_id: str(object(module.department).id || module.department_id),
    is_active: module.is_active ?? true,
  };
}
export function registryPayload(values: RecordData, original?: RecordData) {
  const initial = original ? moduleDefaults(original) : {};
  const body: RecordData = {};
  for (const name of [
    "scope",
    "university_id",
    "faculty_id",
    "department_id",
    "code",
    "title",
    "is_active",
  ]) {
    if (
      !(name in values) ||
      (name === "department_id" && values.scope === "faculty")
    )
      continue;
    const value = name.endsWith("_id") ? Number(values[name]) : values[name];
    if (!original || String(value) !== String(initial[name]))
      body[name] = value;
  }
  return body;
}
export async function institutions(path: string, signal?: AbortSignal) {
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
