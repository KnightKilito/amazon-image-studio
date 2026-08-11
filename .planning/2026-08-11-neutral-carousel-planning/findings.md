# Findings

- Prior diagnosis found that the visible Chinese label is mostly UI, but `lifestyle-carousel` becomes `Lifestyle Carousel Slide` in planner instructions.
- Current carousel guidance always mentions people, casting, pose, and scene regardless of selected content positioning.
- The selected group objective is stored in composed module specs but is not clearly included in the AI module requirement text.
- `createPremiumAPlusGroup` currently defaults every new carousel to the `lifestyle` purpose, and `getPremiumAPlusGroupKindLabel` names the presentation type `模特场景轮播`.
- `buildPremiumAPlusComposedModuleSpecs` hard-codes `Lifestyle Carousel Slide` plus people/pose/scene language for every carousel purpose.
- Existing focused coverage lives in `src/lib/premiumAPlusLayout.test.ts` and `src/lib/listingPlanner.test.ts`; no separate planner-API test file exists.
- The current layout tests cover slot cost and bounds but not carousel default purpose or display naming.
- Existing API tests already inspect the serialized Responses request body, so the regression can assert both objective inclusion and the absence/presence of lifestyle-only guidance without exporting private prompt helpers.
- User-facing references also appear in the editor add button, docs, README, and display-name helper; historical changelog wording can remain as release history.
- `PremiumAPlusGroupKind` is persisted as `lifestyle-carousel`; renaming that union member would create migration risk, so the fix will retain it as a legacy internal identifier while making all active behavior and labels neutral.
- Existing result cards already describe carousel position neutrally (`轮播第 N 张`), so no card interaction change is needed.
