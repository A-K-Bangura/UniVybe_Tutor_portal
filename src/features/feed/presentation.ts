import DOMPurify from "dompurify";
import { safeMediaUrl } from "../../shared/media/urls";
export function feedHtml(content: string) {
  const clean = DOMPurify.sanitize(content, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["img", "video", "iframe", "audio"],
  });
  const doc = new DOMParser().parseFromString(clean, "text/html");
  for (const anchor of doc.querySelectorAll("a")) {
    const url = safeMediaUrl(anchor.getAttribute("href") || "");
    if (url) {
      anchor.setAttribute("href", url.href);
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
    } else anchor.removeAttribute("href");
  }
  return doc.body.innerHTML;
}
