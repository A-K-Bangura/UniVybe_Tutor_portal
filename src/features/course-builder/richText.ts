import DOMPurify from "dompurify";
import { Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

export const richTextTypes = ["plain", "remember", "simply_put", "important"];
export const hasHtml = (value: string) => /<[^>]+>/.test(value);
export function richLink(value: string) {
  if (!/^https?:\/\//i.test(value) || /[\s\\\p{Cc}]/u.test(value))
    return undefined;
  try {
    const url = new URL(value);
    return url.hostname && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

const styles: Record<string, string> = {
  p: "margin:0 0 12px;overflow-wrap:anywhere;",
  h2: "font-size:1.5em;font-weight:700;line-height:1.3;margin:16px 0 12px;overflow-wrap:anywhere;",
  h3: "font-size:1.25em;font-weight:700;line-height:1.3;margin:14px 0 10px;overflow-wrap:anywhere;",
  h4: "font-size:1.125em;font-weight:600;line-height:1.4;margin:12px 0 8px;overflow-wrap:anywhere;",
  ul: "list-style:disc;padding-left:20px;margin:0 0 12px;",
  ol: "list-style:decimal;padding-left:20px;margin:0 0 12px;",
  li: "margin-bottom:4px;",
  blockquote:
    "margin:0 0 12px;padding-left:12px;border-left:3px solid #94a3b8;",
  code: "font-family:monospace;font-size:0.9em;white-space:pre-wrap;overflow-wrap:anywhere;",
  pre: "font-family:monospace;white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%;overflow-x:auto;padding:12px;border:1px solid #94a3b8;margin:0 0 12px;",
  a: "overflow-wrap:anywhere;",
};

/** No author-supplied CSS survives. Rebuild styles from constants and enum values. */
export function lessonHtml(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "del",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
      "code",
      "pre",
      "span",
      "div", // Temporary paste containers; converted to supported paragraphs below.
    ],
    ALLOWED_ATTR: ["href", "style", "start"],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
  const doc = new DOMParser().parseFromString(clean, "text/html");
  for (const div of Array.from(doc.querySelectorAll("div")).reverse()) {
    if (div.querySelector("p,h2,h3,h4,ul,ol,blockquote,pre")) {
      div.replaceWith(...Array.from(div.childNodes));
    } else {
      const paragraph = doc.createElement("p");
      paragraph.style.textAlign = div.style.textAlign;
      paragraph.append(...Array.from(div.childNodes));
      div.replaceWith(paragraph);
    }
  }
  for (const el of doc.body.querySelectorAll<HTMLElement>("*")) {
    const tag = el.tagName.toLowerCase();
    const alignment = el.style.textAlign;
    // Normalize common Word/Docs inline formatting before discarding CSS.
    if (tag === "span") {
      const marks = [];
      if (/^(bold|[6-9]00)$/.test(el.style.fontWeight)) marks.push("strong");
      if (el.style.fontStyle === "italic") marks.push("em");
      if (el.style.textDecoration.includes("underline")) marks.push("u");
      if (el.style.textDecoration.includes("line-through")) marks.push("s");
      for (const mark of marks) {
        const wrapper = doc.createElement(mark);
        wrapper.append(...Array.from(el.childNodes));
        el.append(wrapper);
      }
    }
    const href =
      tag === "a" ? richLink(el.getAttribute("href") || "") : undefined;
    const start = tag === "ol" ? el.getAttribute("start") : null;
    for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
    let style = styles[tag] || "";
    if (
      ["p", "h2", "h3", "h4"].includes(tag) &&
      ["left", "center", "right"].includes(alignment)
    )
      style += `text-align:${alignment};`;
    if (style) el.setAttribute("style", style);
    if (start && /^\d{1,6}$/.test(start)) el.setAttribute("start", start);
    if (href) {
      el.setAttribute("href", href);
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    }
  }
  return doc.body.innerHTML;
}

/** Plain strings enter the editor as text nodes, never as parsed HTML. */
export function lessonDocument(value: string) {
  if (hasHtml(value)) return lessonHtml(value);
  return {
    type: "doc",
    content: value.split(/\n{2,}/).map((paragraph) => ({
      type: "paragraph",
      content: paragraph
        .split("\n")
        .flatMap((line, i) => [
          ...(i ? [{ type: "hardBreak" }] : []),
          ...(line ? [{ type: "text", text: line }] : []),
        ]),
    })),
  };
}

export function lessonText(value: string) {
  if (!hasHtml(value)) return value;
  const doc = new DOMParser().parseFromString(lessonHtml(value), "text/html");
  for (const br of doc.querySelectorAll("br")) br.replaceWith("\n");
  for (const block of doc.querySelectorAll("p,h2,h3,h4,li,blockquote,pre"))
    block.append("\n");
  return (doc.body.textContent || "").trimEnd();
}

const Alignment = Extension.create({
  name: "lessonAlignment",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          textAlign: {
            default: "left",
            parseHTML: (el: HTMLElement) =>
              ["left", "center", "right"].includes(el.style.textAlign)
                ? el.style.textAlign
                : "left",
            renderHTML: (attrs: Record<string, unknown>) => ({
              style: `text-align:${["left", "center", "right"].includes(String(attrs.textAlign)) ? attrs.textAlign : "left"}`,
            }),
          },
        },
      },
    ];
  },
});

export function lessonExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3, 4] },
      horizontalRule: false,
      link: {
        openOnClick: false,
        isAllowedUri: (url) => !!richLink(url),
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      },
    }),
    Alignment,
  ];
}
