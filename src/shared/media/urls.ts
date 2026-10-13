export function safeMediaUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url
      : undefined;
  } catch {
    return undefined;
  }
}
export function youtubeEmbed(url: URL) {
  const host = url.hostname.toLowerCase();
  const short = host === "youtu.be";
  if (
    !short &&
    ![
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "youtube-nocookie.com",
      "www.youtube-nocookie.com",
    ].includes(host)
  )
    return undefined;
  const parts = url.pathname.split("/").filter(Boolean);
  const id = short
    ? parts[0]
    : ["embed", "shorts", "live"].includes(parts[0])
      ? parts[1]
      : url.pathname === "/watch"
        ? url.searchParams.get("v")
        : undefined;
  const list = url.searchParams.get("list");
  const validList =
    list && /^[A-Za-z0-9_-]{10,150}$/.test(list) ? list : undefined;
  if (!id?.match(/^[A-Za-z0-9_-]{11}$/) && !validList) return undefined;
  const embed = new URL(
    `https://www.youtube-nocookie.com/embed/${id?.match(/^[A-Za-z0-9_-]{11}$/) ? id : "videoseries"}`,
  );
  if (validList) embed.searchParams.set("list", validList);
  const time = url.searchParams.get("start") || url.searchParams.get("t");
  if (time) {
    const match = time.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    const seconds = /^\d+$/.test(time)
      ? Number(time)
      : match
        ? Number(match[1] || 0) * 3600 +
          Number(match[2] || 0) * 60 +
          Number(match[3] || 0)
        : 0;
    if (Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 86400)
      embed.searchParams.set("start", String(seconds));
  }
  return embed.href;
}
export function mediaKind(url: URL): "image" | "video" | "link" {
  const path = url.pathname.toLowerCase();
  if (
    /\.(jpe?g|png|gif|webp|avif|svg)$/.test(path) ||
    (url.hostname === "res.cloudinary.com" && path.includes("/image/upload/"))
  )
    return "image";
  if (
    /\.(mp4|webm|mov|ogv)$/.test(path) ||
    (url.hostname === "res.cloudinary.com" && path.includes("/video/upload/"))
  )
    return "video";
  return "link";
}
export function extractLinks(content: string) {
  const doc = new DOMParser().parseFromString(content, "text/html");
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const text: string[] = [];
  while (walker.nextNode())
    if (!walker.currentNode.parentElement?.closest("script,style"))
      text.push(walker.currentNode.textContent || "");
  const candidates = [
    ...Array.from(
      doc.querySelectorAll("a[href]"),
      (a) => a.getAttribute("href") || "",
    ),
    ...(text.join(" ").match(/https?:\/\/[^\s<>"']+/g) || []).map((value) => {
      let url = value.replace(/[.,;!?]+$/, "");
      while (
        url.endsWith(")") &&
        (url.match(/\)/g)?.length || 0) > (url.match(/\(/g)?.length || 0)
      )
        url = url.slice(0, -1);
      return url;
    }),
  ];
  return [
    ...new Set(
      candidates
        .map((s) => safeMediaUrl(s)?.href)
        .filter((s): s is string => !!s),
    ),
  ].slice(0, 6);
}
