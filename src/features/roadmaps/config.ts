import { academic, f } from "../courses/fields";
export const roadmapFields = [
  f("title", "text", true),
  f("description", "textarea"),
  f("thumbnail_url", "url"),
  ...academic,
  f("status", "select", true, ["draft", "published", "archived"]),
];
