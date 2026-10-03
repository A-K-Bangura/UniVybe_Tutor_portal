import { academic, f } from "../courses/fields";
export const userFields = [
  f("email", "email", true),
  f("password", "password", true),
  f("firstname", "text", true),
  f("lastname", "text", true),
  f("phone", "text", true),
  {
    ...f("role_id", "select", true),
    label: "Role",
    help: "Only backend-confirmed roles are offered. Moderator provisioning awaits a complete administrator role lookup.",
  },
  f("status", "select", true, ["pending", "approved", "rejected", "suspended"]),
  ...academic.filter((field) => !["level", "semester"].includes(field.name)),
  f("qualification"),
  f("expertise_area"),
  f("years_experience", "number"),
  f("bio", "textarea"),
];
