# Image Editor Tab and Full-Screen Workspace

## Goal

Add a standalone image-editor page to the existing React 19 + Vite + Zustand app. The page accepts local images, reuses the current AI editing flow and local A+ processing, and shares the existing IndexedDB task/image history without changing the home generation workflow.

## Phases

- [complete] Audit existing navigation, input editing, task persistence, and A+ processing.
- [complete] Add `AppPage`, hash navigation, and temporary editor selection state.
- [complete] Build the full-screen editor workspace and reusable embedded `InputBar` layout.
- [complete] Reuse A+ upscale, slicing, conversion preparation, masking, preview, and download actions.
- [complete] Connect existing result/detail/context-menu entry points to the editor page.
- [complete] Add tests and complete full test/build/worktree verification.
- [complete] Separate image-generation and AI-planning settings, calls, and UI presentation.
- [complete] Rebuild the API settings panel to match the reference site's separated card and per-card management interactions.
- [complete] Widen the settings modal and restore separate advanced settings panes for image generation and AI planning.

## Decisions

- Keep the repository's actual React 19 + Vite + Zustand stack.
- Use an independent `AppPage = 'home' | 'editor'`; `appMode` remains unchanged for Gallery/Agent behavior.
- Use `#home` and `#editor` hash navigation so refresh, direct links, back, and forward work.
- Store editor inputs and derived results in the existing task/image IndexedDB flow.
- Use a three-column desktop workspace and stacked mobile layout.
- Preserve the user's existing uncommitted `src/components/AmazonPlanner.tsx` changes.

## Verification

- `npm.cmd test -- --run`: 29 test files, 318 tests passed after the reference-alignment revision.
- `npm.cmd run build`: TypeScript and Vite production build passed after the reference-alignment revision; Vite reports the existing large-chunk warning.
- `git diff --check`: no whitespace errors.

## Notes

- PowerShell blocks `npm.ps1` in this environment; repository commands use `npm.cmd` instead.
- The slice-task store test uses a canvas-boundary mock because the Vitest Node environment has no browser `Image`; production slicing still uses the existing browser Canvas implementation.

## Next Step

Manual UI check remains: open Settings at desktop and mobile widths, confirm the wider two-card layout, and verify both independent advanced sections and the planner connection-mode controls.
No further implementation step is required for this reference-alignment revision. The remaining manual check is to open Settings, open each card's 管理 menu, and verify the two connection-mode buttons at desktop and mobile widths.
