import { z } from "zod";
import {
  entity,
  object,
  page,
  request,
  rows,
  str,
  type RecordData,
} from "../../shared/api/client";

export const statuses = [
  "draft",
  "pending_approval",
  "rejected",
  "published",
  "closed",
  "unpublished",
] as const;
const permissionKeys = [
  "can_edit",
  "can_submit",
  "can_delete",
  "can_manage_settings",
  "can_close",
  "can_reopen",
  "can_view_applicants",
  "can_rate_workers",
] as const;
export const gigSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    status: z.enum(statuses),
    is_accepting_interest: z.boolean(),
    permissions: z.object(
      Object.fromEntries(
        permissionKeys.map((key) => [key, z.boolean()]),
      ) as Record<(typeof permissionKeys)[number], z.ZodBoolean>,
    ),
  })
  .passthrough();
export function gigEntity(response: RecordData) {
  const gig = entity(response, "gig");
  if (!gigSchema.safeParse(gig).success)
    throw new Error(
      "The server returned an invalid gig state or permissions. Refresh before continuing.",
    );
  return gig;
}
export const key = (id: unknown) => encodeURIComponent(str(id));
export const gigDetail = async (
  id: string,
  admin: boolean,
  signal?: AbortSignal,
) => {
  const response = await request(
    `${admin ? "admin" : "tutor"}/gigs/${key(id)}`,
    "GET",
    undefined,
    signal,
  );
  const gig = gigEntity(response);
  return admin ? { ...gig, events: rows(object(response.data).events) } : gig;
};
export const gigList = async (
  params: URLSearchParams,
  admin: boolean,
  signal?: AbortSignal,
) => {
  const result = page(
    await request(
      `${admin ? "admin" : "tutor"}/gigs?${params}`,
      "GET",
      undefined,
      signal,
    ),
  );
  if (result.items.some((gig) => !gigSchema.safeParse(gig).success))
    throw new Error(
      "The server returned invalid gig permissions. Refresh the list.",
    );
  return result;
};
export const gigCategories = async (admin = false, signal?: AbortSignal) => {
  const data = object(
    (
      await request(
        admin ? "admin/gig-categories" : "gigs/categories",
        "GET",
        undefined,
        signal,
      )
    ).data,
  );
  if (!Array.isArray(data.categories))
    throw new Error("Unexpected gig category response.");
  return rows(data.categories);
};
export const gigOptions = async (signal?: AbortSignal) =>
  object((await request("gigs/options", "GET", undefined, signal)).data);

export function initialValues(gig: RecordData): RecordData {
  return {
    ...gig,
    category_id: str(object(gig.category).id),
    contact_whatsapp: str(object(gig.contact).whatsapp),
    contact_email: str(object(gig.contact).email),
    skills: Array.isArray(gig.skills) ? gig.skills.join("\n") : "",
    tags: Array.isArray(gig.tags) ? gig.tags.join("\n") : "",
    application_deadline: str(gig.application_deadline),
    cover_url: str(object(gig.cover_image).url),
  };
}
const nullable = (v: unknown) => str(v).trim() || null;
const numeric = (v: unknown) => (str(v).trim() ? Number(v) : null);
export function settingsPayload(values: RecordData, original: RecordData = {}) {
  const payload: RecordData = { capacity_type: values.capacity_type || "open" };
  if (payload.capacity_type === "limited")
    payload.applicant_limit = numeric(values.applicant_limit);
  if (str(values.application_deadline) !== str(original.application_deadline))
    payload.application_deadline = nullable(values.application_deadline);
  return payload;
}
export function contentPayload(
  values: RecordData,
  original: RecordData,
  cover: RecordData | null | undefined,
  submit: boolean,
) {
  const payload: RecordData = { ...settingsPayload(values, original), submit };
  for (const name of [
    "title",
    "short_description",
    "description",
    "requirements",
    "contact_whatsapp",
    "contact_email",
    "expected_start_date",
    "expected_completion_date",
  ])
    payload[name] = nullable(values[name]);
  payload.category_id = Number(values.category_id);
  payload.pricing_type = values.pricing_type;
  payload.price_amount = numeric(values.price_amount);
  payload.price_max =
    values.pricing_type === "negotiable" ? numeric(values.price_max) : null;
  payload.work_mode = values.work_mode;
  payload.location =
    values.work_mode === "remote" ? null : nullable(values.location);
  payload.address =
    values.work_mode === "remote" ? null : nullable(values.address);
  for (const name of ["skills", "tags"])
    payload[name] = str(values[name])
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);
  if (cover !== undefined)
    payload.cover_image =
      cover === null
        ? null
        : cover.source === "cloudinary"
          ? { source: "cloudinary", public_id: cover.public_id }
          : { source: "external", url: cover.url };
  return payload;
}
export function adminActions(gig: RecordData) {
  if (gig.deleted_at) return [];
  const status = str(gig.status);
  return [
    ...(["pending_approval", "rejected"].includes(status) ? ["approve"] : []),
    ...(status === "pending_approval" ? ["reject"] : []),
    ...(["published", "closed"].includes(status) ? ["unpublish"] : []),
    ...(status === "unpublished" ? ["restore"] : []),
  ];
}
