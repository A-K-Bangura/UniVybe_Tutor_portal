import { academic, f } from "../courses/fields";
export const resourceFields = [
  f("title", "text", true),
  f("resource_type", "select", true),
  f("description", "textarea"),
  f("author"),
  f("subject"),
  f("module"),
  f("source"),
  f("publication_year", "number"),
  f("tags", "array"),
  ...academic,
];
