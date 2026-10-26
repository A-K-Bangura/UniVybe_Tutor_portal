# Course creation review

26 October 2026. Initial local review through source inspection, student interface captures and isolated browser tests. This is not a completed live educator and student usability study.

## Changes implemented

- Outline groups now use educator terms such as Content blocks. Add actions identify the item being added rather than repeating an ambiguous Add button at every level.
- The outline explains the module → lesson → mini-lesson → blocks hierarchy and where quizzes belong.
- Raw media metadata is now under Advanced media metadata. Validation errors open this section so hidden errors do not prevent correction.
- The block publication checkbox explains that availability depends on the course being published.

## Release checks for the training course

| Priority | Finding and evidence | Required verification |
| --- | --- | --- |
| P1 | Tutor quizPayload stores selected MCQ answer text. The student QuizRenderer normalizes options to numeric string IDs; quizValidation compares those IDs. Backend transformation could reconcile this, but it has not been verified. | Create a real single and multiple answer question through the tutor editor, fetch its student payload and verify correct and incorrect submissions. Fix the transformation at the appropriate contract boundary if needed. |
| P1 | Student QuizRenderer mapQuizType has no tap_fill case for quiz-level questions. Its default is mcq. A nested question with an explicit tap_fill type may avoid this path. | Inspect the actual student API response and test tap-to-fill rendering, word selection and grading. Add the missing mapping if the quiz-level contract is used. |
| P1 | The tutor form preserves spaces for fill blanks but does not identify or count blank markers. The API trims outer whitespace. | Agree on and test the blank syntax across authoring, API and student rendering. Then show inline blank positions and prevent answer count mismatches. |
| P1 | The local draft has five pending assets for link, image, video, embed and document blocks. | Upload approved files, record final URLs, create the actual blocks and test learner access. Do not submit an incomplete training course. |
| P2 | The captured student outline labels the first module Module 0 when its order_index is zero. | Verify the intended indexing contract and render human numbering from position without changing persisted ordering to mask it. |
| P2 | In the 390 pixel student capture, the fixed global bottom navigation overlaps the lesson navigation controls. | Check scrolling, safe area spacing and lesson completion controls on a real mobile device; ensure both navigation bars remain usable. |

The student implementation was inspected read-only at `C:/Users/akbJ/Music/Vybe/Edu_Student_g1/src/components/course/QuizRenderer.tsx`, `src/utils/quizValidation.ts` and `src/components/course/OutlineSidebar.tsx`. No student frontend or backend edits were made.

## Proposed next editor capabilities

These are proposals, not implemented features. Prioritize them during the hands-on authoring walkthrough.

1. **Essential course fields first.** Group title, description and objectives first; place academic context, estimates, tags and pricing suggestions in optional sections. Preserve saved values and open a section when it contains a validation error. Success means a new broad-audience course can be drafted without interpreting institutional fields.
2. **A guided first lesson.** Offer a course starter that creates a module, lesson and mini-lesson with understandable names. Show the exact items before saving. Record partial success and resume safely after an interrupted request.
3. **Save and add another.** Keep the parent selected after a confirmed create, with a new blank editor for the same item type. Prevent duplicate creation when a result is uncertain. Test that the second item has a distinct ID and correct parent.
4. **Media captions and alternatives as ordinary fields.** Provide friendly caption and accessibility fields after the API contract is agreed. Preserve unrecognized metadata instead of replacing the whole object. Keep advanced JSON available for supported properties.
5. **A publishing readiness check.** Inspect the entire saved tree for empty containers, unavailable items, missing media and unresolved quiz errors. Link each issue to its editor. Avoid claiming that a URL syntax check proves media access or successful grading.
6. **Duplicate a lesson or module.** Copy its descendants under newly returned IDs, preserve ordering and allow retry without duplicate trees. Define attachment and publication behavior before implementation.
7. **Draft recovery.** Provide a clearly labelled local recovery copy with course and account scoping. Show the difference from the saved version; never silently overwrite newer server content.

## Repeatable walkthrough

Use an approved educator or tutor test account to create the training course from this local draft. For every action record the parent, fields shown, time taken, validation errors, expected result, actual result and screenshot. Save and reopen each item. Interrupt one save and verify recovery. Reorder siblings and refresh. Test publication availability and submission for review. Use a separate student test account to verify media, correct and incorrect quiz answers, progress and sequential access on desktop and mobile.

Keep evidence for each type separately. A screenshot of one multiple choice question does not validate the other quiz types. Close a finding only after its expected behavior is reproduced against the actual API.

## Verification recorded

- Unit suite: 43 tests passed, including training format coverage and valid example checks.
- Typecheck, lint and production build passed. The existing large bundle warning remains.
- Tutor portal browser checks: 35 passed, including block previews, quiz authoring, answer ordering, retained drafts, uncertain saves, layout and navigation.
- Four screenshots captured from the existing student build using illustrative API data; all nonlocal network traffic blocked. These are presentation evidence, not live integration evidence.
- The HTML companion was inspected on desktop and mobile. All four embedded images loaded and the mobile guide had no horizontal overflow. Word layout remains unverified because LibreOffice is unavailable; the generated Word copy is excluded from delivery.
- No course was imported, submitted, approved or published.
