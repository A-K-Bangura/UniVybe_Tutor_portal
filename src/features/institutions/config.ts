import { f } from "../courses/fields";
export const institutionFields = (kind: string) => [
  ...(kind === "faculties"
    ? [f("university_id", "number", true)]
    : kind === "departments"
      ? [f("faculty_id", "select", true)]
      : []),
  f("name", "text", true),
  f("code"),
  ...(kind === "faculties"
    ? [f("dean_name"), f("contact_email", "email")]
    : kind === "departments"
      ? [f("head_name"), f("contact_email", "email")]
      : [f("country"), f("city"), f("website", "url")]),
  f("description", "textarea"),
  f("is_active", "boolean"),
];
