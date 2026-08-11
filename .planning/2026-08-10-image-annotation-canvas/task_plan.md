# Image Annotation Canvas Integration

## Goal

Integrate the annotation canvas and visual-guide submission behavior from upstream commit `becb3a03` into the existing three-column image editor without replacing its current InputBar, mask, A+, result, history, or API-profile workflows.

## Phases

- [complete] Audit exact current/upstream component, store, type, icon, and test boundaries.
- [complete] Add reusable annotation types, geometry/hit-testing, guide rendering, and prompt composition helpers.
- [complete] Build and integrate `ImageAnnotationCanvas` with responsive desktop/mobile interactions.
- [complete] Add editor draft state, image-edit task metadata, and explicit editor submission flow.
- [complete] Add regression/unit tests for canvas logic, task ordering, masks, limits, cleanup, and editor resets.
- [complete] Run full tests, production build, diff checks, and targeted manual/static review.
- [complete] Fix API credential editing, explicit-empty URL persistence, and field-specific validation.
- [complete] Add regression coverage and rerun targeted/full verification.
- [complete] Restore the custom image-provider creation entry removed by the split settings cards.
- [complete] Verify permissions, provider creation flow, tests, build, and diff integrity.
- [complete] Diagnose and fix result-preview selection locking in the image editor.
- [complete] Add selection regression coverage and rerun targeted/full verification.
- [complete] Restore visible, per-pane configuration-name editing for image generation and AI planning.
- [complete] Verify rename persistence, permissions, tests, build, and diff integrity.

## Decisions

- Use normalized SVG annotations over the native image; add no canvas framework dependency.
- Keep only committed annotations in shared editor draft state; tool choice, zoom, and undo/redo are component-local.
- Preserve all current editor layout and product capabilities; only the central canvas and editor-mode submission behavior change.
- Keep the current output settings and image-generation profile system; do not import Seedream provider/settings UI.
- Use `image-edit` as a distinct task workflow and retain the user-visible prompt separately from the internal augmented prompt.
- Treat upstream local commit `becb3a03` as the fixed implementation reference.

## Verification

- `npm.cmd test -- --run src/lib/imageEditorAnnotations.test.ts`: 6 tests passed.
- Interim `npm.cmd run build`: passed after canvas/store-draft integration; only the existing large-chunk warning remains.
- Targeted editor/store/history suites: 3 files, 102 tests passed.
- Final `npm.cmd test -- --run`: 30 files, 335 tests passed.
- Final `npm.cmd run build`: passed; only the existing Vite large-chunk warning remains.
- Final `git diff --check`: passed; Git only reports the repository's normal LF-to-CRLF notices.
- Static responsive review: canvas toolbar/color/width rows scroll horizontally, the stage keeps touch-safe Pointer Events, and reference/result/style previews do not discard the main image draft.
- Follow-up targeted `apiProfiles` suite: 36 tests passed.
- Follow-up full `npm.cmd test -- --run`: 30 files, 337 tests passed.
- Follow-up `npm.cmd run build`: passed; only the existing Vite large-chunk warning remains.
- Follow-up `git diff --check`: passed; only the repository's normal LF-to-CRLF notices were reported.
- Custom-provider entry follow-up: full Vitest run passed 30 files / 337 tests.
- Custom-provider entry follow-up: production build passed with only the existing Vite large-chunk warning.
- Custom-provider entry follow-up: `git diff --check` passed with only normal LF-to-CRLF notices.
- Result-selection follow-up: targeted selection tests passed 2/2.
- Result-selection follow-up: full Vitest run passed 31 files / 339 tests.
- Result-selection follow-up: production build and `git diff --check` passed; only existing chunk-size and normal LF-to-CRLF warnings remain.
- Profile-name follow-up: targeted profile suite passed 36/36; full Vitest run passed 31 files / 339 tests.
- Profile-name follow-up: production build and `git diff --check` passed; only existing chunk-size and normal LF-to-CRLF warnings remain.

## Errors Encountered

- Initial combined type/library patch failed because one `types.ts` context line used the terminal's mojibake rendering instead of the file's UTF-8 text. Resolution: apply smaller patches anchored on stable TypeScript declarations.
- First annotation test run had one floating-point equality mismatch (`0.6000000000000001`). Resolution: assert normalized coordinates with `toBeCloseTo`; implementation behavior was correct.
- First targeted store run exposed one existing assertion tied to the established style-limit wording. Resolution: retained the compatible “实际参考图数量” phrase while preserving the new guide-specific hint.
- Final TypeScript build caught an overly narrow inferred test-helper ID type after adding history tests. Resolution: declared the helper ID as `string`; production code was unaffected.
- Direct invocation of the planning completion checker was blocked by the machine's PowerShell execution policy. Resolution: rerun the same read-only checker in a child PowerShell process with `-ExecutionPolicy Bypass`.
- The first combined settings patch missed the exact legacy API-key block context and was rejected atomically. Resolution: split the change into smaller patches anchored on the current UTF-8 source.
