# Neutral Carousel Planning Fix

## Goal

Make Premium A+ carousel modules content-neutral so the selected content-position objective is the primary AI-planning instruction, while lifestyle-specific people/pose/scene guidance is applied only when the selected purpose is lifestyle.

## Phases

- [complete] Audit carousel labels, spec construction, planner prompts, and existing tests.
- [complete] Implement neutral carousel naming and objective-first conditional guidance.
- [complete] Add focused regression tests for lifestyle and non-lifestyle carousel planning.
- [complete] Run targeted/full tests, production build, and diff integrity checks.

## Decisions

- Preserve the existing freely composed Premium A+ layout and data schema.
- Treat carousel as a presentation form; derive semantic guidance from the selected content position.
- Keep lifestyle-specific continuity rules only for the lifestyle purpose.

## Errors Encountered

- None.

## Verification

- Targeted Premium A+ suites: 2 files / 48 tests passed.
- Full Vitest suite: 31 files / 342 tests passed.
- `npm.cmd run build`: passed; only the existing Vite large-chunk warning remains.
- `git diff --check`: passed; only normal LF-to-CRLF notices were reported.
- Static residual scan: no active non-test `模特场景轮播`, `Lifestyle Carousel Slide`, or unconditional casting/pose carousel instruction remains.
