import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/react";
import {
  hasHtml,
  lessonDocument,
  lessonExtensions,
  lessonHtml,
  lessonText,
} from "./richText";
import { blockDefaults, blockIssues, blockPayload } from "./blocks";

const create = (value: string) =>
  new Editor({
    extensions: lessonExtensions(),
    content: lessonDocument(value),
  });
describe("lesson rich text contract", () => {
  it("round trips mixed formatting, lists, alignment, code and special characters", () => {
    const editor = create(
      '<h2 style="text-align:center">Title &amp; more</h2><p><strong>Bold</strong> <em>italic</em> <u>underline</u> <s>strike</s> <code>x&lt;5</code><br>next</p><ul><li><p>First</p></li><li><p>Second</p></li></ul><ol start="3"><li><p>Third</p></li></ol><blockquote><p>Quote</p></blockquote><p><a href="https://example.com">Link</a></p>',
    );
    const html = lessonHtml(editor.getHTML());
    const reopened = create(html);
    expect(lessonHtml(reopened.getHTML())).toBe(html);
    for (const expected of [
      "text-align:center",
      "font-size:1.5em",
      "list-style:disc",
      "list-style:decimal",
      "<strong>",
      "<em>",
      "<u>",
      "<s>",
      "<code",
      "x&lt;5",
      "border-left",
      "noopener noreferrer",
      'start="3"',
    ])
      expect(html).toContain(expected);
    editor.destroy();
    reopened.destroy();
  });
  it("loads plain text as text nodes and escapes angle brackets on editing", () => {
    const editor = create("A & B\nnext\n\n5 < 8");
    expect(editor.getText()).toContain("5 < 8");
    expect(editor.getHTML()).toContain("&lt;");
    expect(editor.getHTML()).toContain("<br>");
    const values = { ...blockDefaults({}), content: "unchanged & plain" };
    expect(blockPayload(values, {}).content).toBe(values.content);
    editor.destroy();
  });
  it("rejects executable markup, dangerous URLs, arbitrary CSS, attributes and tables", () => {
    const html = lessonHtml(
      '<script>alert(1)</script><iframe src="https://evil.test"></iframe><img src=x onerror="alert(1)"><p id="x" onclick="alert(1)" style="position:fixed;color:black;background:url(https://evil.test);text-align:right">Safe</p><a href="java&#115;cript:alert(1)">bad</a><a href="https://user:pass@example.com">credentials</a><table><tr><td>Cell</td></tr></table><svg onload="alert(1)"></svg>',
    );
    expect(html).toContain("text-align:right");
    for (const forbidden of [
      "script",
      "iframe",
      "<img",
      "onclick",
      "onerror",
      "position",
      "color:",
      "background",
      "javascript",
      "href=",
      "<table",
      "<svg",
      'id="',
    ])
      expect(html).not.toContain(forbidden);
    expect(lessonHtml(html)).toBe(html);
  });
  it("normalizes document paste and validates visible content", () => {
    expect(
      lessonText(lessonHtml("<div>One</div><div>Two<br>Three</div>")),
    ).toBe("One\nTwo\nThree");
    const editor = create(
      lessonHtml(
        '<p class="MsoNormal"><span style="font-weight:700;font-style:italic;text-decoration:underline;color:red">Docs</span></p>',
      ),
    );
    expect(editor.getHTML()).toContain("<strong><em><u>Docs</u></em></strong>");
    expect(
      blockIssues({ ...blockDefaults({}), content: "<p><br></p>" }),
    ).toHaveProperty("content");
    expect(lessonText("<p>One<br>Two</p><p>Three</p>")).toBe("One\nTwo\nThree");
    expect(hasHtml(lessonHtml(editor.getHTML()))).toBe(true);
    editor.destroy();
  });
  it("does not sanitize or HTML-encode literal formula, prompt and link payloads", () => {
    for (const text_type of ["formula", "prompt", "link"]) {
      const values = {
        ...blockDefaults({}),
        text_type,
        content: "literal <tag> & \\frac{a}{b}",
      };
      expect(blockPayload(values, {}).content).toBe(values.content);
    }
  });
  it("supports selected formatting, heading/list commands, clearing and undo/redo", () => {
    const editor = create("First second");
    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.commands.toggleBold();
    expect(editor.getHTML()).toContain("<strong>First</strong> second");
    editor.commands.undo();
    expect(editor.getHTML()).not.toContain("<strong>");
    editor.commands.redo();
    expect(editor.getHTML()).toContain("<strong>");
    editor.commands.setHeading({ level: 3 });
    expect(editor.getHTML()).toContain("<h3");
    editor.chain().unsetAllMarks().clearNodes().run();
    expect(editor.getHTML()).not.toMatch(/<strong>|<h3/);
    editor.commands.toggleBulletList();
    expect(editor.getHTML()).toContain("<ul>");
    editor.commands.toggleOrderedList();
    expect(editor.getHTML()).toContain("<ol>");
    editor.destroy();
  });
});
