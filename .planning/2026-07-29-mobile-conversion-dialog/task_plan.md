# Mobile A+ Conversion Dialog

## Goal

Require the user to confirm how many panels a source image represents before converting it to Mobile A+, and support manually slicing the generated Mobile A+ mother image.

## Phases

- [x] Add a Mobile A+ conversion count dialog with metadata only as a preselection.
- [x] Pass the explicit user-selected count into conversion state and task metadata.
- [x] Generalize vertical slicing for Premium and Mobile A+ mother images.
- [x] Add regression tests, verify UI, run full tests and build.

## Constraints

- Old tasks without metadata must remain usable.
- Conversion must never silently rely on inferred metadata after the dialog is introduced.
- Single-image conversion remains available as one selectable option.
- Preserve unrelated dirty-worktree changes.

## Errors Encountered

None.
