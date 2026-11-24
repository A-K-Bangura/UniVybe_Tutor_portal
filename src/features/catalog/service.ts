import {
  request,
  entity,
  page,
  str,
  type RecordData,
} from "../../shared/api/client";
import type { Role } from "../../shared/auth/session";
import { resourceSchema } from "../resources/dto";
import { opportunitySchema } from "../opportunities/dto";
import {
  academicModuleSchema,
  moduleRecord,
  modulesPage,
} from "../academic-modules/api";
export const singular: Record<string, string> = {
  courses: "course",
  resources: "resource",
  opportunities: "opportunity",
  feed: "post",
  users: "user",
  roadmaps: "roadmap",
  universities: "university",
  faculties: "faculty",
  departments: "department",
  organizations: "organization",
  "academic-modules": "academic_module",
};
export const base = (kind: string, role: Role) =>
  `${["admin", "super_admin"].includes(role) || !["courses", "resources", "opportunities", "feed"].includes(kind) ? "admin" : "tutor"}/${kind}`;
export const editBase = (kind: string) =>
  `${["courses", "resources", "opportunities", "feed"].includes(kind) ? "tutor" : "admin"}/${kind}`;
export const list = async (
  kind: string,
  role: Role,
  params: URLSearchParams,
  signal?: AbortSignal,
) => {
  const filters = new URLSearchParams(params);
  const creator = filters.get("created_by");
  if (
    kind === "courses" &&
    ["admin", "super_admin"].includes(role) &&
    creator &&
    !/^[1-9]\d*$/.test(creator)
  ) {
    // Auth profile IDs are UUIDs; the course filter requires the numeric ID.
    const user = entity(
      await request(
        `admin/users/${encodeURIComponent(creator)}`,
        "GET",
        undefined,
        signal,
      ),
      "user",
    );
    const id = str(user.id);
    if (!/^[1-9]\d*$/.test(id))
      throw new Error("Unable to resolve the course creator's numeric ID.");
    filters.set("created_by", id);
  }
  return kind === "academic-modules"
    ? modulesPage(params, true, signal)
    : page(
        await request(
          `${base(kind, role)}?${filters}`,
          "GET",
          undefined,
          signal,
        ),
        kind === "feed" && !["admin", "super_admin"].includes(role),
      );
};
export const detail = async (
  kind: string,
  role: Role,
  id: string,
  signal?: AbortSignal,
) => {
  const value = entity(
    await request(
      `${base(kind, role)}/${encodeURIComponent(id)}`,
      "GET",
      undefined,
      signal,
    ),
    singular[kind],
  );
  const schema =
    kind === "resources"
      ? resourceSchema
      : kind === "opportunities"
        ? opportunitySchema
        : kind === "academic-modules"
          ? academicModuleSchema
          : undefined;
  if (schema && !schema.safeParse(value).success)
    throw new Error(
      `The server returned an invalid ${singular[kind]} state or permission contract.`,
    );
  return value;
};
export const save = async (kind: string, values: RecordData, id?: string) => {
  const r = await request(
    editBase(kind) + (id ? `/${encodeURIComponent(id)}` : ""),
    id ? "PUT" : "POST",
    values,
  );
  const result = kind === "users" && !id ? r.data : entity(r, singular[kind]);
  return kind === "academic-modules"
    ? moduleRecord(result as RecordData)
    : result;
};
