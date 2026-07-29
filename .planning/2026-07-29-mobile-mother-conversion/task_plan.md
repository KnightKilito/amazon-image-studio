# Mobile A+ Mother Image Conversion

## Goal

When converting a Premium A+ continuous mother image to Mobile A+, preserve its panel count and generate one mobile mother image at `1200 x (900 * sliceCount)`.

## Phases

- [x] Add mobile mother-image size helpers and exact-size preservation.
- [x] Make output conversion prompt, params, and category slice-aware.
- [x] Add regression tests and run full verification.

## Constraints

- Ordinary single-image Mobile A+ conversion remains 1200x900.
- Derived individual slices convert as single images, not as another mother image.
- Preserve unrelated dirty-worktree changes.

## Errors Encountered

None.
