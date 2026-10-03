import {
  request,
  entity,
  page,
  type RecordData,
} from "../../shared/api/client";
import type { Role } from "../../shared/auth/session";
import { resourceSchema } from "../resources/dto";
import { opportunitySchema } from "../opportunities/dto";
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
};
export const base = (kind: string, role: Role) =>
  `${role === "admin" || !["courses", "resources", "opportunities", "feed"].includes(kind) ? "admin" : "tutor"}/${kind}`;
export const editBase = (kind: string) =>
  `${["courses", "resources", "opportunities", "feed"].includes(kind) ? "tutor" : "admin"}/${kind}`;
export const list = async (
  kind: string,
  role: Role,
  params: URLSearchParams,
  signal?: AbortSignal,
) =>
  page(
    await request(`${base(kind, role)}?${params}`, "GET", undefined, signal),
    kind === "feed" && role !== "admin",
  );
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
  return kind === "users" && !id ? r.data : entity(r, singular[kind]);
};
