# Premium A+ Layout Research Plan

## Goal

Design a flexible Premium A+ planning system that supports independent modules, continuous canvases sliced after generation, product-specific brand stories, and optional lifestyle carousels without changing existing behavior.

## Phases

- [complete] Inspect the five supplied Amazon screenshots and identify recurring layout structures.
- [complete] Map those structures onto the current planner, task, size, history, and detail-view architecture.
- [complete] Define the composable UI model, planner schema, generation workflow, detail-page cutting workflow, and compatibility rules.
- [complete] Present the complete implementation plan for user approval. No product code changes in this phase.
- [complete] Refine the design so 5/6/7-panel layouts can be generated as a single provider-supported mother image without automatic fallback splitting.
- [complete] Implement the Premium-only composed layout editor, planner metadata, exact mother-image sizes, and provider capability controls.
- [complete] Integrate detail-page slicing, derived task persistence, image-retention rules, and grouped ZIP download.
- [complete] Add focused regression tests and run the full test/build verification.
- [complete] Start the local app and visually verify the composed planner and slicing workflow on desktop and mobile.

## Constraints

- Keep the existing independent-module workflow unchanged and default.
- Show the new workflow only for Premium A+.
- Generate a complete mother image first; perform slicing only from the generated-image detail page.
- Support varied compositions rather than a fixed set of templates.
- Brand story content must be product-specific and can use a wide background split into panels.
- Existing planner history must remain compatible.
- Provider capability controls may warn or block known unsupported profiles, but must never silently convert a single mother-image plan into multiple generation requests.

## Errors Encountered

| Error | Resolution |
|---|---|
| Amazon pages could not be reliably read through browser automation | User supplied full-page screenshots for direct visual analysis. |
| New geometry test used `Array.prototype.at`, but the project TypeScript target does not include ES2022 | Replaced it with an indexed last-item lookup. |
