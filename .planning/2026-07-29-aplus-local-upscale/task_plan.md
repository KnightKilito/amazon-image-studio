# Local A+ Minimum Upscale

## Goal

Add a browser-side proportional upscale action for undersized A+ outputs, saving the result as a new local task without calling an AI API.

## Phases

- [x] Add reusable proportional upscale geometry and Canvas processing.
- [x] Save upscaled PNG/high output as a new task while preserving source metadata.
- [x] Always show the detail-page upscale action for Premium and Mobile A+ images.
- [x] Add tests, documentation, browser verification, full tests and build.
- [x] Add batch upscaling for multi-output A+ tasks and save all results in one new task.
- [x] Verify batch behavior, rerun tests and build.

## Constraints

- Premium A+ minimum: 1464x600.
- Mobile A+ minimum: 600x450.
- Preserve aspect ratio; never crop or stretch.
- Do not call an external API.
- Preserve unrelated dirty-worktree changes.

## Errors Encountered

- Initial combined patch missed the exact documentation wording; reapplied the edits in smaller scoped patches.
- Browser verification exposed an undefined image-size value before image load; normalized it to an empty string so the always-visible button remains safely disabled until dimensions arrive.
