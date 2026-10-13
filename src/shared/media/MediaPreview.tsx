import { useState } from "react";
import { safeMediaUrl, youtubeEmbed, mediaKind, extractLinks } from "./urls";

export function MediaPreview({
  url,
  kind,
  caption,
}: {
  url: string;
  kind?: string;
  caption?: string;
}) {
  if (!url.trim())
    return (
      <p className="muted">
        Add a media URL or upload media to see its preview.
      </p>
    );
  const parsed = safeMediaUrl(url);
  if (!parsed)
    return (
      <p className="field-error">
        Enter a valid HTTP or HTTPS URL to preview this media.
      </p>
    );
  return (
    <Preview
      key={`${parsed.href}-${kind}`}
      url={parsed}
      kind={kind}
      caption={caption}
    />
  );
}
function Preview({
  url,
  kind,
  caption,
}: {
  url: URL;
  kind?: string;
  caption?: string;
}) {
  const [failed, setFailed] = useState(false);
  const youtube =
    kind !== "image" && kind !== "document" ? youtubeEmbed(url) : undefined;
  const resolved = kind === "image" ? "image" : mediaKind(url);
  return (
    <figure className="media-preview">
      {youtube ? (
        <iframe
          className="media-embed"
          src={youtube}
          title={caption || "YouTube video preview"}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-presentation"
        />
      ) : !failed && resolved === "image" ? (
        <img
          className="preview-image"
          src={url.href}
          alt={caption || "Media preview"}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : !failed && resolved === "video" ? (
        <video
          controls
          preload="metadata"
          className="preview-image"
          src={url.href}
          onError={() => setFailed(true)}
        />
      ) : null}
      {failed && (
        <p className="field-error">
          Media could not be loaded. Check the URL or open the original.
        </p>
      )}
      <figcaption className="link-preview">
        <span className="eyebrow">
          {youtube
            ? "YouTube"
            : resolved === "link"
              ? kind === "document"
                ? "Document"
                : "Link"
              : resolved === "image"
                ? "Image"
                : "Video"}{" "}
          · {url.hostname}
        </span>
        {caption && <p>{caption}</p>}
        <a href={url.href} target="_blank" rel="noopener noreferrer">
          {url.href} ↗
        </a>
      </figcaption>
    </figure>
  );
}
export function LinkPreviews({
  content,
  exclude = [],
}: {
  content: string;
  exclude?: string[];
}) {
  const urls = extractLinks(content).filter(
    (url) => !exclude.some((value) => safeMediaUrl(value)?.href === url),
  );
  return urls.length ? (
    <div className="link-previews">
      {urls.map((url) => (
        <MediaPreview key={url} url={url} />
      ))}
    </div>
  ) : null;
}
