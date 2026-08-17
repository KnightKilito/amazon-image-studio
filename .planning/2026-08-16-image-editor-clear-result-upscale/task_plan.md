# Image Editor Clear, Result Promotion, and Custom Upscale

## Goal

Fix image-editor clearing so the main image is actually removed, allow generated outputs to become the editable main image, and extend local upscale tools with proportional and user-defined target dimensions.

## Phases

- [complete] Audit editor clear/selection/result-promotion state and current local upscale implementation.
- [complete] Implement correct clear and result-to-main-image behavior without disturbing unrelated workspace changes.
- [complete] Add proportional/custom-size upscale UI, validation, processing, and persistence.
- [complete] Add focused regression tests and run full tests, build, and diff checks.

## Decisions

- Preserve all existing unrelated Listing-copy and documentation changes in the dirty worktree.
- Reuse the existing editor source-switch reset path so annotations, masks, prompt, and style state remain coherent.
- Keep browser Canvas processing and existing derived-task history; do not add backend APIs or database schema changes.

## Errors Encountered

- Local Vite preview reported expected `/admin-api/settings` proxy connection refusals because the separate admin backend was not started. The editor page itself rendered normally and browser console inspection showed no application errors.

## Verification

- Targeted suites: 3 files / 96 tests passed.
- Full Vitest suite: 36 files / 389 tests passed.
- `npm.cmd run build`: passed; only the existing Vite large-chunk warning remains.
- `git diff --check`: passed; only normal LF-to-CRLF notices were reported.
- Browser verification: editor page, default/custom upscale selection, exact width/height controls, and right-sidebar layout rendered correctly with no application console errors.
- Diff scope review: product edits are limited to image-editor/InputBar/upscale/store files and their tests; unrelated existing Listing-copy changes were preserved.
