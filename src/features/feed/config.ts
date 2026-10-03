import { f } from "../courses/fields";
export const feedFields = [
  f("type", "select", true, [
    "tip",
    "meme",
    "announcement",
    "question",
    "discussion",
  ]),
  f("title"),
  { ...f("content", "textarea", true), type: "richtext" as const },
  f("media_url", "url"),
  f("tags", "array"),
];
