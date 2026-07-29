# Premium A+ Vertical Mother Image

## Goal

Correct continuous Premium A+ mother images to stack panels vertically, use invisible horizontal slice boundaries, and keep generation, slicing, validation, UI, docs, and tests consistent.

## Phases

- [x] Audit all horizontal mother-image assumptions.
- [x] Change dimensions, prompts, slicing, and validation to vertical stacking.
- [x] Update UI copy, documentation, and regression tests.
- [x] Run focused tests, full tests, build, and diff checks.
- [x] Make continuous mother-image planning master-canvas-first rather than panel-first.
- [x] Clarify exact canvas ratio and per-slice upload wording.
- [x] Add regression coverage and rerun full verification.

## Constraints

- Preserve unrelated dirty-worktree changes.
- Do not render visible cut lines in generated images.
- Each final Premium A+ panel remains 2928x1200 generation size and 1464x600 upload size.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Two focused assertions failed because expected capitalization/wording differed from the actual new prompt text. | 1 | Updated assertions to match the emitted requirements; implementation output already contained the intended rules. |
