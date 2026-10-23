import { object, str, type RecordData } from "../../shared/api/client";

export const blockTypes = ["text", "image", "video", "embed", "document"];
export const textTypes = [
  "plain",
  "simply_put",
  "important",
  "remember",
  "formula",
  "link",
  "prompt",
];
export function blockLink(value: string, maxLength = 2048) {
  if (
    Array.from(value).length > maxLength ||
    /\s|\p{Cc}/u.test(value) ||
    value.includes("\\") ||
    !/^https?:\/\//i.test(value)
  )
    return undefined;
  const authority = value.split("://")[1]?.split(/[/?#]/)[0];
  if (authority?.includes("@")) return undefined;
  try {
    const url = new URL(value);
    return url.hostname && !url.username && !url.password ? url : undefined;
  } catch {
    return undefined;
  }
}
export interface BlockValues {
  content_type: string;
  text_type: string;
  content: string;
  media_url: string;
  media_metadata: string;
  link_label: string;
  is_published: boolean;
}
export function blockDefaults(initial: RecordData): BlockValues {
  return {
    content_type: str(initial.content_type) || "text",
    text_type: str(initial.text_type) || "plain",
    content: str(initial.content),
    media_url: str(initial.media_url),
    media_metadata:
      initial.media_metadata == null
        ? ""
        : JSON.stringify(initial.media_metadata, null, 2),
    link_label: str(object(initial.media_metadata).label),
    is_published: initial.is_published === true,
  };
}
export function blockIssues(values: BlockValues) {
  const errors: Record<string, string[]> = {};
  if (!blockTypes.includes(values.content_type))
    errors.content_type = ["Choose a content type."];
  if (values.content_type === "text") {
    if (!textTypes.includes(values.text_type))
      errors.text_type = ["Choose a text type."];
    if (!values.content.trim())
      errors.content = [
        values.text_type === "formula"
          ? "Formula blocks need non-empty LaTeX. Delete the block to remove a formula."
          : "Text blocks need non-empty content.",
      ];
    else if (values.text_type === "link" && !blockLink(values.content))
      errors.content = [
        "Enter one http:// or https:// URL, up to 2048 characters, without credentials, spaces or control characters.",
      ];
    if (
      values.text_type === "link" &&
      values.link_label.trim() &&
      (Array.from(values.link_label.trim()).length > 100 ||
        /\p{Cc}|:\/\//u.test(values.link_label.trim()))
    )
      errors.link_label = [
        "Use a single-line label of at most 100 characters without a web address. Put longer instructions in a plain text block.",
      ];
  } else if (!blockLink(values.media_url, Infinity))
    errors.media_url = [
      "This block needs a valid HTTP or HTTPS media URL without credentials or spaces.",
    ];
  if (
    !(
      values.content_type === "text" &&
      ["link", "prompt"].includes(values.text_type)
    ) &&
    values.media_metadata.trim()
  ) {
    try {
      const parsed: unknown = JSON.parse(values.media_metadata);
      if (parsed !== null && typeof parsed !== "object") throw new Error();
    } catch {
      errors.media_metadata = [
        "Enter a JSON object or array, or leave metadata blank.",
      ];
    }
  }
  return errors;
}
export function blockPayload(
  values: BlockValues,
  initial: RecordData,
): RecordData {
  const payload: RecordData = {
    content_type: values.content_type,
    content: values.content,
    is_published: values.is_published,
  };
  const text = values.content_type === "text",
    link = text && values.text_type === "link",
    prompt = text && values.text_type === "prompt";
  if (text) payload.text_type = values.text_type;
  else payload.media_url = values.media_url;
  const original = blockDefaults(initial);
  if (link) {
    // An unchanged URL edit must not replace the link's metadata.
    if (values.link_label !== original.link_label) {
      const metadata = { ...object(initial.media_metadata) };
      if (values.link_label.trim()) metadata.label = values.link_label;
      else delete metadata.label;
      payload.media_metadata = Object.keys(metadata).length ? metadata : null;
    }
  } else {
    if (!prompt && values.media_metadata !== original.media_metadata)
      payload.media_metadata = values.media_metadata.trim()
        ? JSON.parse(values.media_metadata)
        : null;
    if (
      (prompt ||
        (initial.content_type === "text" && initial.text_type === "link")) &&
      "label" in object(initial.media_metadata)
    ) {
      const metadata = {
        ...object(
          payload.media_metadata === undefined
            ? initial.media_metadata
            : payload.media_metadata,
        ),
      };
      delete metadata.label;
      payload.media_metadata = Object.keys(metadata).length ? metadata : null;
    }
  }
  return payload;
}
export function blockTitle(data: RecordData) {
  return (
    str(data.title || data.question) ||
    (data.content_type === "text" &&
    ["link", "prompt"].includes(str(data.text_type))
      ? `${data.text_type === "link" ? "Link" : "Prompt"} block`
      : `${str(data.content_type)} block`)
  );
}
