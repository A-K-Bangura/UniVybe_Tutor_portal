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
    help: "Roles and account creation permissions come from the administrator role directory.",
  },
  f("status", "select", true, ["pending", "approved", "rejected", "suspended"]),
  ...academic.filter((field) => !["level", "semester"].includes(field.name)),
  f("qualification"),
  f("expertise_area"),
  f("years_experience", "number"),
  f("bio", "textarea"),
];
