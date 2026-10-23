import { expect, it } from "vitest";
import {
  blockDefaults,
  blockIssues,
  blockLink,
  blockPayload,
  blockTitle,
} from "./blocks";

it("only allows a single absolute HTTP(S) link without credentials or whitespace", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,hi",
    "file:///tmp/a",
    "ftp://example.org",
    "example.org",
    "https://user:pass@example.org",
    "https://@example.org",
    "https://example.org/a b",
    "https://example.org/a\nb",
    "https://example.org/\u0000",
    "https://example.org/" + "a".repeat(2048),
    "https://example.org\\evil",
  ])
    expect(blockLink(value), value).toBeUndefined();
  expect(blockLink("https://chatgpt.com/?q=hello%20world")?.hostname).toBe(
    "chatgpt.com",
  );
  expect(blockLink("http://example.org/#section")?.protocol).toBe("http:");
});
it("prompt text survives serialization byte-for-byte without HTML or length transformations", () => {
  const prompt =
    "  You are a tutor for {{grade}}.\n\n  <task>Explain [fractions] 📚</task>\n```js\n  const path = 'C:\\notes';\n```\n" +
    "Keep this text. ".repeat(2200) +
    "\n  ";
  const values = { ...blockDefaults({}), text_type: "prompt", content: prompt };
  expect(blockIssues(values)).toEqual({});
  expect(blockPayload(values, {}).content).toBe(prompt);
  expect(blockPayload(values, {})).not.toHaveProperty("media_metadata");
  for (const text_type of ["prompt", "formula", "link"])
    expect(
      blockIssues({ ...values, text_type, content: " \n\t" }),
    ).toHaveProperty("content");
});
it("keeps unchanged metadata out of URL edits and preserves unrelated keys when labels change", () => {
  const initial = {
    id: 40,
    content_type: "text",
    text_type: "link",
    content: "https://example.org",
    media_metadata: { label: "Open tool", custom: "Retain me" },
  };
  const values = { ...blockDefaults(initial), content: "https://chatgpt.com" };
  expect(blockPayload(values, initial)).not.toHaveProperty("media_metadata");
  expect(
    blockPayload({ ...values, link_label: "New tool" }, initial).media_metadata,
  ).toEqual({ label: "New tool", custom: "Retain me" });
  expect(
    blockPayload({ ...values, link_label: "" }, initial).media_metadata,
  ).toEqual({ custom: "Retain me" });
  const onlyLabel = { ...initial, media_metadata: { label: "Open tool" } };
  expect(
    blockPayload({ ...blockDefaults(onlyLabel), link_label: "" }, onlyLabel)
      .media_metadata,
  ).toBeNull();
});
it("validates labels and clears link-only metadata when changing type", () => {
  const initial = {
    content_type: "text",
    text_type: "link",
    content: "https://example.org",
    media_metadata: { label: "Open tool" },
  };
  const values = blockDefaults(initial);
  for (const link_label of [
    "x".repeat(101),
    "Two\nlines",
    "Open https://other.org",
    "control\tlabel",
  ])
    expect(blockIssues({ ...values, link_label })).toHaveProperty("link_label");
  expect(blockIssues({ ...values, link_label: "Open chatgpt.com" })).toEqual(
    {},
  );
  expect(blockIssues({ ...values, link_label: " ".repeat(101) })).toEqual({});
  const image = {
    // A conversion must not resend the old text subtype.
    ...values,
    content_type: "image",
    media_url: "https://example.org/image.png",
  };
  expect(blockIssues(image)).toEqual({});
  expect(blockPayload(image, initial)).not.toHaveProperty("text_type");
  expect(blockPayload(image, initial).media_metadata).toBeNull();
  expect(
    blockPayload(
      { ...values, text_type: "prompt", content: "Help me learn" },
      initial,
    ).media_metadata,
  ).toBeNull();
  expect(blockTitle(initial)).toBe("Link block");
  expect(blockTitle({ content_type: "text", text_type: "prompt" })).toBe(
    "Prompt block",
  );
});
