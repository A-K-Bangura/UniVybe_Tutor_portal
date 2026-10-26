# Educator course creation draft

This local package contains a five module training course with twelve lessons and seven worked quiz examples. Its hierarchy uses the current UniVybe course structure. No course has been written to a platform database.

- `course-creation-manual.md` is the readable companion with student portal screenshots.
- `course-creation-manual.html` is the self contained illustrated guide, checked at desktop and mobile widths.
- `course-draft.json` is the structured curriculum, using the existing authoring field names and parent-child nesting. It is not a supported bulk import payload.
- `review-log.md` records implemented editor changes, compatibility checks and proposed capabilities.
- `screenshots/` contains real student interface captures with illustrative training data. The captures show a short demonstration course rather than the full twelve lesson draft.
- `course-creation-manual.docx` is an internal generated working copy. Its layout has not been verified because the bundled renderer requires LibreOffice, which is unavailable on this machine. Use the Markdown or HTML companion for review.

Five assets need final approved URLs: the reference link, screenshot image, workflow video, embedded activity and companion document. The JSON explicitly tracks these under pending_assets instead of inventing working media URLs. All authored publication flags are false.

To transfer the draft later, create the course first, then its modules, lessons, mini-lessons, blocks and quizzes using the returned IDs. Quizzes attach to lessons. There is no implemented bulk import route; review any future importer separately and make partial saves recoverable. Check every publication setting and validate the actual student experience before submission.

The curriculum and companion are generated together by `scripts/build-course-manual.py`. Student captures use `scripts/capture-manual.mjs`, which serves the sibling student build read-only and intercepts API traffic with illustrative data. The screenshot fixture uses the student option-ID shape, so it is intentionally not evidence that the tutor payload is compatible with student grading.
