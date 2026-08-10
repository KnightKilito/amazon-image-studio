# Progress

## 2026-08-10

- Read and applied the `planning-with-files` skill.
- Restored the completed prior editor/settings plan and confirmed the Git worktree is clean on `develop`.
- Created this dedicated implementation plan from the user-approved scope.
- Located the exact current and upstream component/store/type boundaries and confirmed the current project already shares the low-level viewport/canvas helpers used elsewhere upstream.
- Confirmed the integration can stay schema-compatible by adding optional task metadata and a persisted Zustand draft only.
- Reviewed the current three-column JSX and isolated the central rendering surface as the only workspace UI region that needs replacement.
- Captured upstream annotation event handling, history bounds, zoom behavior, normalized rendering, and task metadata shape for generic porting.
- Finalized the implementation approach: shared current submit path with explicit editor inputs, optional image-edit metadata, and a display-prompt adapter.
- Logged and corrected a failed patch-context attempt; no source changes were applied by that failed patch.
- Added generic image-editor annotation/draft/task-context types, `image-edit` workflow support, display-prompt helper, and the standalone annotation geometry/guide/prompt library.
- Added six focused annotation tests covering prompt numbering, all shape hit tests, bounded movement, natural-resolution rendering, arrows, and PNG guide export; targeted suite passes.
- Ported the required canvas SVG icons and added `ImageAnnotationCanvas` with draw/select/move/erase, undo/redo, colors, widths, 50–300% zoom, pan, keyboard, wheel, and Pointer Events.
- Replaced the workspace's static image with the canvas while preserving material previews and A+ controls; input source changes now confirm before discarding annotations and clear mismatched masks.
- Added normalized/persisted editor canvas draft state and included its source in image-reference cleanup. Interim production build passes.
- Routed editor-mode `InputBar` submission through `submitImageEditorTask`, generating/storing a natural-resolution guide only when annotations exist and preserving source → guide → references → style order.
- Added `imageEditContext`, user-facing prompt display, history classification/filtering, retry preservation, provider-limit guide priority, and guide cleanup on failed pre-task submission/deletion.
- Added store/history regressions for ordering, no-guide submission, mask+guide, limits, failed-profile cleanup, retry, persistence, task deletion, classification, and original-prompt search. Targeted suites pass (102 tests).
- Review follow-up: kept normal references in preview mode, added an explicit “设为当前主图” action, and preserved local undo/zoom state while temporarily previewing references/results/styles.
- Final verification completed: 30 test files / 335 tests passed, production build passed, and `git diff --check` passed with line-ending notices only.
- Started a follow-up settings regression phase for API Key reveal/cut behavior, preserving a manually cleared API URL, and reporting the correct missing-field error.
- Located the regressions in the rebuilt settings cards: missing key reveal UI, default-on-save URL normalization, and status labels that collapse all validation failures into a Key error.
- Added profile-specific Key reveal controls to both split cards and the legacy details form, retained selectable/editable inputs, preserved explicitly blank URLs through normalization/save, and surfaced field-specific status messages.
- Added URL persistence/validation regressions; targeted `apiProfiles` suite passes 36 tests.
- Full Vitest run passes 30 files / 337 tests; production TypeScript/Vite build also passes with only the existing large-chunk warning.
- Final settings diff review passed: no stale shared Key visibility state or save-time blank-URL fallback remains; import links also retain an explicitly blank URL.
- Started a settings regression follow-up to restore custom provider creation directly from the image-generation pane.
- Confirmed the custom-provider modal and permission logic still exist; only the split image card lost its provider dropdown/action. Chose to restore that dropdown with target-aware profile switching.
- Restored the provider `Select` under the visible “图片服务” field, including the existing custom-provider action/edit/delete/reorder options, and added target-aware switching so it always updates the selected image profile.
- Verified the restored flow with 30 files / 337 tests, a successful production build, and a clean diff check.
