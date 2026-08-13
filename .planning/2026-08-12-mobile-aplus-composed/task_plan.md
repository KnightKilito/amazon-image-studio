# Mobile A+ Composed Main Content

## Goal

Reuse the Premium A+ main-content composed-generation workflow for Mobile A+ through shared abstractions, while using Mobile-specific 2K/4K geometry and keeping Brand Story Premium-only.

## Phases

- [complete] Reconcile the approved plan with concurrent Brand Story and Listing Copy worktree changes.
- [complete] Generalize layout types, profiles, geometry, spec building, and prompt rules.
- [complete] Integrate independent Premium/Mobile layout state and the shared editor into Amazon Planner.
- [complete] Preserve legacy sessions/tasks and verify slicing/exact-size handling.
- [complete] Add regressions, run targeted/full tests and production build, then inspect the final diff.

## Decisions

- Premium and Mobile keep separate `independent`/`composed` modes and group lists.
- Both composed main-content modes use a seven-slot budget.
- Mobile supports independent images, continuous mother images, and carousels only.
- Mobile 2K single-panel generation is 1200x900; 4K is 2400x1800; mother-image height is the per-panel height times slice count.
- Brand Story remains Premium-only and concurrent Brand Story work must be preserved.
- Existing persisted Premium fields remain readable as a legacy fallback.

## Errors Encountered

- The worktree contains concurrent, uncommitted Brand Story and Listing Copy changes in overlapping files. Resolution: edit the current file versions incrementally and avoid resetting or switching the shared active planning pointer.
- A large `listingPlanner.ts` patch was rejected because the shared file changed after inspection. Resolution: no partial edit was applied; split the work into smaller semantic patches against the latest file.
- The first production build found that the new state-normalization test used partial persisted states while the function signature required complete states. Resolution: widened only the normalization input type to partial per-content states; output remains fully normalized.
