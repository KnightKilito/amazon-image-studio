# Findings

- Current implementation models continuous mother images as width `2928 * sliceCount` by height `1200`.
- Planner prompts explicitly request vertical cut lines every 2928px.
- Amazon Premium A+ modules are displayed vertically, so visual continuity requires a `2928 x (1200 * sliceCount)` mother image.
- Slice boundaries should be invisible horizontal boundaries used only as safe-area guidance.
- `ImageSliceDialog` currently draws vertical guides and `imageSlicing.ts` divides width; both must switch to height-based slicing.
- Persisted derivations use `premium-aplus-horizontal-slices`; retain that type in the union for old records while writing a new vertical type.
- Settings and Markdown documentation still describe ultra-wide sizes and must be updated to tall continuous canvases.
- Historical planner sessions may persist the old horizontal `plannedGenerationSize`; generation-size helpers must recompute continuous-canvas sizes from `sliceCount` before trusting persisted dimensions.
- A generated 2-slice example visibly changes subject, camera, copy hierarchy, and composition at the midpoint because the AI plan explicitly assigns separate upper and lower strategies.
- The actual output was 979x1610, which does not match the requested 2928x2400 ratio. The phrase `1464x600 × 2片` and panel-first wording can confuse models, although upstream size support remains authoritative.
- Continuous mother-image prompts must prioritize one uninterrupted master composition; future slices are sequential crops, not independently art-directed panels.
