# Mini-lesson rich text

## Audit and scope

`BlockForm.tsx` owns the mini-lesson block draft in React Hook Form. Previously every text subtype used a textarea. `blocks.ts` validates drafts and creates the existing `content: string` / `text_type` payload. `Builder.tsx` submits only on explicit save, refreshes query data after success, preserves failed drafts, and uses stable form keys. This implementation keeps those paths, ordering, publishing and uncertain-save reconciliation intact. There is no runtime course-content import/staging workflow in this repository; the optional training-draft coverage fixture does not submit data. No automatic writes, API/schema changes, or student-app edits were added.

The feed editor already supplies Tiptap 3 StarterKit and DOMPurify dependencies. The lesson editor reuses those libraries with a separate lesson-specific schema and sanitizer so existing feed behavior is unaffected. No dependencies were added. Tiptap's structured document model, commands, selection and HTML serializer provide the editing architecture; see the official [extension API](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension).

The supplied styling guide was read completely. Its HTML detection regex and direct `dangerouslySetInnerHTML` behavior were verified against `Student/Edu_Student_g1/src/components/course/MiniLessonRenderer.tsx`, and the table/pre/code global CSS was checked in its `src/index.css`.

## Behavior and output

Only plain, remember, simply_put and important use `LessonRichText`. It provides bold/italic/underline/strike, inline code, HTTP(S) links, paragraphs, H2–H4, bullet/numbered and nested lists, indentation, blockquotes, paragraph/heading alignment, undo/redo and clear formatting. StarterKit supplies conventional shortcuts and list Enter behavior; Shift+Enter adds a hard break. Selection is retained for toolbar clicks and link editing. Buttons have accessible names/tooltips, active states and keyboard focus; toolbar controls wrap on small screens.

Initial plain text is loaded as structured text nodes, with blank lines mapped to paragraphs and single newlines to hard breaks. Merely opening a block does not mark it dirty or rewrite its content. Editing emits Tiptap HTML; the normalization pass adds Option A spacing, heading sizes, list markers, indentation, wrapping and theme-neutral quote/code borders. DOM APIs and Tiptap serialize text safely, including literal `<`, `>` and `&`. Markdown is never generated. The student app's ambiguous legacy HTML-detection heuristic is retained for previously stored strings.

Formula, link and prompt retain their previous fields and literal payloads. Converting rich HTML to one of these types opens a review dialog and requires explicit conversion; cancel retains all formatting. Conversion retains a formatted backup in memory, available via Restore formatted draft until the editor is left. Restoring replaces the current content and selects plain. Existing URL validation and optional metadata label remain unchanged.

`Preview.tsx` displays sanitized HTML instead of raw tags and retains callout containers and the formula/link/prompt renderers. `blocks.ts` sanitizes HTML again at the explicit save boundary and rejects visually empty rich content. Unchanged plain strings remain plain strings.

## Security and required backend work

DOMPurify restricts elements to p/br, inline marks, h2–h4, ul/ol/li, blockquote, a, code/pre and span. Event handlers, images, scripts, frames, SVG, tables, data attributes, arbitrary attributes and executable markup are removed. Author CSS is never forwarded: only known semantic styles are generated, with left/center/right alignment and bounded numeric ordered-list start retained. Links must be absolute HTTP(S), have a hostname, and contain no credentials, backslashes, spaces or control characters. Output anchors get noopener/noreferrer. Paste from Word/Docs common span bold/italic/underline/strike styles is converted to semantic marks; unsupported structures are flattened or dropped by the sanitizer and schema. Desktop document list formats relying on proprietary metadata may require manually reapplying list formatting.

**Outstanding release security risk:** client-side sanitization is bypassable. The adjacent Laravel backend was inspected read-only because the requested deliverable is in this frontend repository. `Edu-lift/app/Http/Requests/Api/V1/Tutor/MiniLessonBlocks/{Store,Update}MiniLessonBlockRequest.php` accepts rich `content` as a nullable string; `ValidatesTextTypeBlocks.php` applies extra rules only to formula/link/prompt. Neither enforces this HTML allowlist. The student renderer injects stored HTML without sanitization. This implementation does not make the overall system secure.

Before production rollout, the backend must enforce an HTML parser-based allowlist equivalent to `richText.ts` for every write of rich-capable mini-lesson content (create, partial updates, admin writes, legacy mini-lesson content, imports and bulk paths). Resolve effective content_type/text_type against the existing record on partial updates; never apply rich sanitization to formula/link/prompt literals. Reject unsupported executable structures/attributes, validate decoded URL schemes and credentials, regenerate constant styles and validated alignment/start values, reject empty visible content, enforce request size limits, and return the canonical saved value. Add backend regression tests with encoded/obfuscated malicious URLs, event handlers, CSS, SVG/MathML, malformed HTML, type transitions and partial updates. Audit existing stored HTML and sanitize it before it reaches students. Independently add defensive sanitization in student HTML renderers, including feed HTML; that is outside this repository.

## Tables

Excluded. The existing student app has only global max-width/overflow rules on the table itself. It lacks a contained accessible scroll region and scroll indication; a table schema alone cannot meet the mobile and theme requirements. Student renderer changes and light/dark mobile verification are prerequisites to enabling table authoring.

## Files and verification

- `LessonRichText.tsx`: lesson toolbar and controlled editor.
- `richText.ts`: schema configuration, normalization, URL policy, plain text conversion and constant inline styles.
- `BlockForm.tsx`: integration, explicit conversion and backup restoration.
- `blocks.ts`: visible-content validation and save-boundary sanitization.
- `Preview.tsx`, `src/styles/index.css`: HTML preview and editor presentation.
- `richText.test.ts`: semantic round trips, escaping, sanitization, paste, literal payloads and editing/history commands.
- `tests/e2e/blocks.spec.ts`: browser persistence/conversion, paste normalization, callouts, mobile layout and accessibility, alongside existing block regressions.

Verification on 2026-11-18: production build, typecheck, lint and diff whitespace checks passed. Vitest: 55 passed, 2 skipped (optional pre-existing fixtures). Playwright: the full 10-test block suite passed; the additional paste/callout/mobile test passed separately, for 11 passing browser checks. These cover save/reopen, no writes during formatting, conversion cancellation/restoration, supported paste marks, removal of unsafe HTML, list markers, clear formatting, all four rich text types, 320/375px page overflow checks and an axe check with no serious/critical violations on the rich editor form. The generated 320px screenshot was visually inspected for preview typography, list markers, links and quote styling. The build retains its large-chunk warning.

Browser persistence tests mock the existing API; they do not prove production database behavior. Screenshots are produced in Playwright test output. The actual running Student Portal was not exercised: authenticated student lesson rendering, both light/dark themes, desktop and 320–375px widths, long links and server persistence remain manual integration checks. This is explicit verification debt, not a claim of end-to-end student validation.
