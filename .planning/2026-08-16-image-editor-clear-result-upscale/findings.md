# Findings

- The worktree contains unrelated, pre-existing Listing-copy and documentation changes; target edits must stay isolated to image-editor/local-processing files and tests.
- Editor source state is split across `editorActiveImageId`, `editorActiveTaskId`, `editorCanvasDraft.sourceImageId`, and shared `inputImages`; clearing only the shared inputs cannot by itself clear the displayed canvas source.
- The existing local A+ upscale/derived-task implementation is concentrated in `ImageEditorWorkspace.tsx`; focused selection logic already has pure tests in `imageEditorSelection.test.ts`.
- `currentImageId` falls back through active selection, first input, style image, then active-task output. Therefore clearing inputs without resetting editor selection/draft can keep the old main image visible.
- The canvas “设为当前主图” affordance is rendered only for `currentInputImage`; output previews are excluded even though their image data is available. A separate “将当前结果作为输入继续编辑” button exists, but its availability is based only on “not currently an input” and is not integrated with the canvas promotion affordance.
- Existing upscale always calls `createAPlusUpscaleTaskFromImage(source, format)`, which delegates to a fixed 2x-or-minimum `getAPlusUpscalePlan`; the derived-task pipeline already records actual output dimensions and can be extended without schema changes.
- The InputBar clear confirmation always calls only `clearInputImages()`, regardless of layout. The editor-specific action must also reset active image/task and canvas draft, while leaving prompt and style-reference semantics unchanged.
- `currentImageId` automatically falls back to a style reference, which can make the canvas remain non-empty after main inputs are cleared; style images should remain selectable previews but should not auto-become the canvas image.
- The existing result-continuation path uses `openImageEditor(imageId)`, which already performs the required reset of prompt, mask, style reference, active task, and annotations. Reusing it for the canvas “设为当前主图” action matches the established behavior.
- Upscale task tests already mock `upscaleImageDataUrlForAPlus`, and the helper tests cover proportional geometry; custom target validation and store metadata can be added at these existing seams.
- `InputBar` imports operational store helpers directly, so an exported `clearImageEditorInputs()` can be invoked only for `layout="editor"` while the home clear behavior stays unchanged.
- Existing `openImageEditor` coverage and state reset make it safer to route output promotion through that function than to duplicate image caching/reset logic in the component.
- Current task labels and history metadata hard-code “等比放大”; custom target mode needs a distinct “自定义尺寸放大” label while retaining the same `derived` image persistence and PNG/high-quality output metadata.
- Browser verification confirmed the editor renders the default “等比放大（默认）” selector, exposes width/height spinbuttons after choosing “自定义尺寸”, and keeps the controls readable within the desktop right sidebar.
- The local editor page produced no browser-console warnings or errors; only the development terminal logged the expected missing optional admin-backend proxy connection.
