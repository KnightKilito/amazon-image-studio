# Mother Image Generation Only

## Goal

Keep Premium A+ continuous-canvas planning and image prompts focused on generating one complete mother image. Cropping, resizing, saving, and downloading remain website-only post-processing actions.

## Phases

- [x] Remove cropping/upload actions from planner instructions and image prompts.
- [x] Preserve invisible safe-boundary composition guidance without asking AI to crop.
- [x] Update tests and run full verification.

## Constraints

- Preserve unrelated dirty-worktree changes.
- Keep the existing website slicing feature unchanged.
- Continue preventing key subjects and complete copy blocks from crossing future website split boundaries.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Combined patch missed an existing test assertion | 1 | Re-read the exact test block and split the edit into smaller patches. |
| Focused test expected the previous wording `必须先按` | 1 | Updated the assertion to the new equivalent wording `必须按`. |
