import type { Field } from "../../shared/forms/SchemaForm";
export const registryFields: Field[] = [
  {
    name: "scope",
    type: "select",
    required: true,
    options: ["faculty", "department"],
  },
  { name: "university_id", type: "number", required: true },
  { name: "faculty_id", type: "number", required: true },
  {
    name: "department_id",
    type: "number",
    visibleWhen: { field: "scope", value: "department" },
  },
  {
    name: "code",
    required: true,
    maxLength: 30,
    help: "Official code, up to 30 characters. Duplicate codes ignore case, spaces and punctuation.",
  },
  { name: "title", required: true, maxLength: 255 },
  {
    name: "is_active",
    type: "boolean",
    label: "Active",
    help: "Deactivate to retire a module. Existing courses retain it.",
  },
];
