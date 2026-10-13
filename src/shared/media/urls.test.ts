import { describe, expect, it } from "vitest";
import { safeMediaUrl, youtubeEmbed, mediaKind, extractLinks } from "./urls";
import { feedHtml } from "../../features/feed/presentation";

describe("media presentation URL handling", () => {
  it("recognizes supported YouTube URL forms without trusting host lookalikes", () => {
    for (const url of [
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://m.youtube.com/shorts/dQw4w9WgXcQ",
      "https://youtube.com/live/dQw4w9WgXcQ",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    ])
      expect(youtubeEmbed(new URL(url))).toBe(
        "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      );
    expect(
      youtubeEmbed(
        new URL("https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ"),
      ),
    ).toBeUndefined();
    expect(
      youtubeEmbed(new URL("https://youtube.com/watch?v=invalid")),
    ).toBeUndefined();
    expect(
      youtubeEmbed(new URL("https://youtu.be/dQw4w9WgXcQ?t=1m30s")),
    ).toContain("start=90");
    expect(
      youtubeEmbed(
        new URL("https://youtube.com/playlist?list=PL1234567890abc"),
      ),
    ).toContain("videoseries?list=PL1234567890abc");
  });
  it("rejects active protocols and URL credentials and identifies media with queries", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:image/svg+xml,x",
      "file:///test",
      "https://user:secret@example.test/a",
    ])
      expect(safeMediaUrl(url)).toBeUndefined();
    expect(
      mediaKind(new URL("https://example.test/PHOTO.PNG?token=synthetic")),
    ).toBe("image");
    expect(
      mediaKind(
        new URL("https://res.cloudinary.com/demo/video/upload/example"),
      ),
    ).toBe("video");
    expect(mediaKind(new URL("https://example.test/article"))).toBe("link");
  });
  it("extracts and deduplicates rich text links and plain URLs without unsafe links", () => {
    expect(
      extractLinks(
        "Read (https://example.test/guide) and https://example.test/Topic_(Part).",
      ),
    ).toEqual([
      "https://example.test/guide",
      "https://example.test/Topic_(Part)",
    ]);
    expect(
      extractLinks(
        '<p><a href="https://example.test/guide">Guide</a> https://example.test/guide https://youtu.be/dQw4w9WgXcQ.</p><a href="javascript:alert(1)">bad</a>',
      ),
    ).toEqual(["https://example.test/guide", "https://youtu.be/dQw4w9WgXcQ"]);
  });
  it("sanitizes feed HTML and creates safe external anchors rather than trusting embedded markup", () => {
    const html = feedHtml(
      '<script>alert(1)</script><iframe src="https://evil.test"></iframe><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">bad</a><a href="https://example.test" onclick="alert(1)">Guide</a><strong>Bold</strong>',
    );
    expect(html).not.toMatch(/<script|<iframe|<img|onclick|javascript:/);
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("<strong>Bold</strong>");
  });
});
