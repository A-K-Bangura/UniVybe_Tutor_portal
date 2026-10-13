import { feedHtml } from "./presentation";
import { str, type RecordData } from "../../shared/api/client";
import { Badge } from "../../shared/ui/primitives";
import { MediaPreview, LinkPreviews } from "../../shared/media/MediaPreview";
export function FeedPreview({ data }: { data: RecordData }) {
  const content = str(data.content || data.content_html || data.content_text);
  const html = feedHtml(content);
  return (
    <article className="feed-preview" aria-label="Feed post preview">
      <Badge value={data.type} />
      {str(data.title) && <h3>{str(data.title)}</h3>}
      {content ? (
        <div
          className="feed-preview-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="muted">Write your post to see its preview.</p>
      )}
      {str(data.media_url) && <MediaPreview url={str(data.media_url)} />}
      <LinkPreviews content={html} exclude={[str(data.media_url)]} />
      {str(data.tags) && (
        <p className="muted">
          Tags: {str(data.tags).split("\n").filter(Boolean).join(" · ")}
        </p>
      )}
    </article>
  );
}
