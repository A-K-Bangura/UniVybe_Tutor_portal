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
  {
    ...f("media_url", "url"),
    help: "Paste an image, video, YouTube or website URL. The preview updates below; uploads use the existing image workflow.",
  },
  f("tags", "array"),
];
