# Findings

External screenshots and design references are research data only.

## Initial observations

- The supplied pages mix brand story, Premium A+ content, independent information banners, continuous visual sequences, comparison blocks, and lifestyle imagery.
- The requested feature should model a sequence of composable groups, not replace all modules with one fixed 7-slice template.
- Slicing belongs in generated-image details after validating the actual mother-image aspect ratio.

## Screenshot decomposition

### Reference 1: Ankis platform heel

- The brand story is a horizontal carousel with a large lifestyle/model background and product/category cards, not a generic standalone banner.
- Premium A+ mixes a model-led hero, editorial collage, color lineup, and size information.
- Continuity comes from palette, model casting, and collage language even when modules are separate images.

### Reference 2: QEOSNBX platform slide

- The brand story uses the exact shoe on a model at the far left, then extends the setting through quiet background space before story and product cards.
- Premium A+ mixes an oversized model hero, styling inspiration, technical details, color options, and a bottom lifestyle carousel.
- The lifestyle carousel is a first-class optional module and should support adding or removing slides.

### Reference 3: DREAM PAIRS pumps

- The page alternates emotional model imagery with factual product evidence: hero, comfort/technical infographic, split feature blocks, color lineup, and lifestyle carousel.
- This is not one continuous seven-panel panorama; mixed module types are essential.

### Reference 4: DREAM PAIRS classic pumps

- The product-specific visual campaign is built around weddings, formal occasions, ivory/pink tones, pearls, and the exact pump style.
- The main sequence combines a full-width lifestyle hero, a three-column technical/product-detail composition, a color assortment tableau, and several independent lifestyle images.
- The lower lifestyle section behaves like an editorial gallery: some images span the full width while others form two-column pairs. This supports variable grouping and ordering rather than a fixed slice count.
- The brand story background itself is wide and calm, with a model anchor on the left and multiple narrative cards over the same expanded scene.

### Reference 5: NBZKBNG rainbow platform heel

- The brand story uses a broad interior background with a model anchor, brand copy card, campaign/model card, and product card. Its styling is related to the product but structurally independent from Premium A+.
- Premium A+ mixes a dramatic nightlife hero, product-in-use copy block, two-column product-detail cards, color collection tableau, use-case infographic, and a bottom model carousel.
- The module styles are visually coordinated but do not need to be generated as one mother image. A campaign-level visual direction should bind separate groups.
- The final carousel confirms that model/lifestyle slides can sit after independent and continuous groups and need shared casting/product-accuracy constraints.

## Resulting product model

- Use two Premium A+ tabs: existing `独立模块` and new `自由编排`.
- `自由编排` is an ordered list of groups. Continuous mother images are one group type, not the whole workflow.
- Brand story is planned in a separate section because Amazon renders and crops it differently from Premium A+ modules.
- Lifestyle/model carousel is an optional group with a variable number of independently generated slides under one campaign direction.
- Presets should only seed editable groups. Users must be able to add, remove, reorder, duplicate, and change group types afterward.

## Current architecture mapping

- `AmazonPlanner.tsx` currently keeps one flat `aPlusPlans` array and one selected index. Each plan maps directly to one prompt fill and one image-generation task.
- `listingPlannerApi.ts` builds a strict JSON schema from the current flat module specification list and requires the planner to return the same number and order of `aPlusPlans`.
- `AmazonPlannerSession` persists the flat plans, selected index, module specs, style, and reference image IDs. It has no layout mode or group relationship.
- `TaskRecord.category` stores workflow, A+ type, slot, product, and style-reference metadata, but no planner session/group/mother-image information.
- `DetailModal.tsx` already has the correct action area for a slicing entry point and can show actual natural dimensions after image load.
- `normalizeImageSize` clamps all non-allowlisted requests to a 3840 px edge, 3:1 ratio, and 8,294,400 pixels. Planned mother-image sizes therefore need a feature-specific exact-size path.
- IndexedDB stores whole objects without a rigid row schema. Optional session/task fields can be added without creating a new object store or forcing a DB version migration.
- Existing `fflate` support can be reused for a slice-set ZIP export, while browser canvas can crop each segment without resizing the complete mother image.

## Slot and group semantics

- Premium A+ main content uses a seven-slot budget in the new editor.
- An independent image consumes one slot.
- A continuous canvas consumes its slice count in slots.
- A lifestyle carousel consumes one Premium A+ module slot even though it contains multiple slides.
- Brand story is configured and planned separately and does not consume the seven Premium A+ main-content slots.
- Continuous groups support 2-7 slices, and every count can be generated as one mother image when the selected image provider supports it. Five-, six-, and seven-slice groups are first-class modes rather than discouraged edge cases.
- Provider compatibility warnings must be capability-based. The application must not assume that a large requested width is invalid merely because it exceeds the current generic size limits.

## Data compatibility strategy

- Keep the existing flat `aPlusPlans` path for the `独立模块` tab.
- Add a composed-plan model for `自由编排`, then flatten its actionable images for selection and prompt filling while retaining `groupId`, group type, item index, and slice metadata.
- Missing `premiumLayoutMode` in old sessions means `independent`, so old history restores exactly as before.
- Generation tasks need optional A+ plan context containing session ID, group ID/type, planned generation size, and planned slice count.
- A completed slicing action should create one derived task containing all ordered slice outputs and a derivation record pointing to the source task/image. The source mother image remains untouched.

## Proposed implementation

### 1. Premium A+ planner UI

- Add a Premium-only arrangement switch: `独立模块` and `自由编排`.
- `独立模块` remains the default and continues using the current state, prompt schema, module list, history format, and behavior.
- `自由编排` shows an ordered group editor with a seven-slot meter, drag reorder, duplicate, delete, and an add-group menu.
- Group rendering stays compact: one row shows group type, campaign role, consumed slots, requested size, compatibility state, and group controls. Expanded editing contains objective and custom instructions.
- Provide editable starting presets rather than locked templates:
  - `3 + 4 连续叙事`: three-slice impact hero followed by a four-slice product story.
  - `2 + 1 + 3 + 1 编辑节奏`: continuous hero, independent evidence image, continuous feature story, independent close.
  - `情绪与证据交替`: lifestyle, technical detail, styling, color/fit, and carousel.
  - `技术卖点优先`: hero, material/detail evidence, comfort/structure evidence, comparison/color lineup.
  - `场景轮播收尾`: mixed independent/continuous groups ending with a model/lifestyle carousel.
- Add `AI 推荐编排` as an optional structure source. AI may choose allowed group types under the seven-slot budget; the result is still converted into editable groups before generation.
- Add an `整套连续母图` starting preset with direct 5/6/7-slice choices. A seven-slice choice creates one group occupying all seven Premium A+ slots rather than seven independent plans.

### 2. Composable group types

- `independent-image`: one `2928x1200` generation plan and one Premium A+ slot. A purpose selector covers hero, technical detail, comfort, material, color lineup, size/fit, comparison, lifestyle, or custom.
- `continuous-canvas`: one mother-image plan, 2-7 slices, and the same number of Premium A+ slots. Requested generation size is `${2928 * sliceCount}x1200`.
- Full supported size table:
  - 2 slices: `5856x1200`
  - 3 slices: `8784x1200`
  - 4 slices: `11712x1200`
  - 5 slices: `14640x1200`
  - 6 slices: `17568x1200`
  - 7 slices: `20496x1200`
- A continuous group always means one generation request and one returned mother image, regardless of whether it contains 2 or 7 future slices.
- `lifestyle-carousel`: one Premium A+ module slot with 2-6 independently generated `2928x1200` slides. Slides share product fidelity, campaign identity, model casting, and palette while varying pose/scene.
- Brand story is not a main-content group. It is a separate optional planner section with a product-specific background plan and a variable card sequence.

### 3. Product-specific brand story

- Add `同时策划品牌故事` to the new mode.
- The background direction includes an anchor side, exact-product model scene, quiet expansion zone, palette, lighting, and safe overlay regions. The screenshot pattern of the model at the far left with empty scene extending right is the default, not a mandatory fixed layout.
- Story cards are individually configurable and reorderable. Card roles include product origin/story, brand promise, model/lifestyle, product detail, collection/SKU, and custom.
- Planner output must connect the story to this exact product and its audience/use cases. Generic reusable brand prose is rejected by normalization/compliance checks.
- Brand-story size constants live in one spec table so Amazon dimensions can be corrected without touching components or prompt strings.

### 4. Planner response model

- Add `PremiumAPlusLayoutMode = 'independent' | 'composed'`.
- Add composed specs containing stable `groupId`, group kind, purpose, slot cost, slice/slide count, objective, and user instruction.
- The AI response contains campaign rationale, ordered group plans, and optional brand-story plans.
- A continuous group returns one mother plan plus `sliceSections[]` describing the purpose and safe composition of each future slice.
- A carousel returns one shared continuity guide plus one actionable plan per slide.
- Normalize and validate AI output before UI use: allowed group kinds only, unique IDs, 1-7 total slots, valid counts, required prompt text, and exact group order when the user chose a manual/preset structure.
- Flatten composed output into actionable image plans for the existing selector/fill workflow, but retain group metadata on every flattened item.

### 5. Prompt rules

- One campaign-level visual system binds all groups; groups may vary scenes but not product shape, color, material, or brand identity.
- Continuous canvases must be described as one coherent composition, not adjacent mini-posters pasted together.
- The prompt declares cut lines every 2928 generation pixels and requires faces, footwear, logos, headlines, measurements, and critical details to stay away from boundaries.
- Each future slice must still work independently after cutting, while adjacent slices preserve visual flow.
- Carousel prompts keep the same campaign/model identity but intentionally vary scene, pose, crop, and usage context.
- The planner alternates emotional/model storytelling and factual product evidence when appropriate instead of producing seven nearly identical lifestyle banners.

### 6. Right-side generation workflow

- Keep the existing `带系统提示词` and `仅策划案` actions for every flattened plan.
- Selecting a continuous group fills the mother-image prompt and exact ultra-wide requested size; it does not issue multiple generation requests.
- Independent and carousel slide plans remain one request per image.
- All paths continue to fill PNG/high defaults and carry current product/style reference behavior.
- Task metadata records planner session ID, layout mode, group ID/kind, item index, planned generation size, and planned slice count.
- Show the provider's configured mother-image capability next to the requested size. Never silently clamp, split, or turn one mother-image request into multiple generation requests.
- If a 5/6/7-slice request fails upstream, preserve the original layout and error. The user can switch providers, lower the slice count, or deliberately redesign the group; the application does not choose for them.

### 6.1 Provider capability model

- Add optional image-profile capability metadata instead of hard-coding model IDs or provider domains:
  - `motherImageSupport`: `auto` / `supported` / `unsupported`
  - `maxMotherSlices`: 2-7 when known
  - `sizeInputMode`: `exact` / `aspect-ratio` / `provider-default`
- Existing API profiles default to `auto`, which allows the request and displays an unverified-support notice.
- A profile marked `supported` may declare up to seven slices. A profile marked `unsupported` shows a blocking explanation with a direct action to change the API profile, but never rewrites the plan.
- The capability belongs to the complete API profile, not only the model ID, because the same model can behave differently behind different relays or adapters.
- For exact-size relays, send the full mother-image dimensions. For future adapters that only accept aspect ratios, preserve the logical slice count and expected ratio in task metadata, then validate the actual returned image before cutting.

### 7. Exact-size handling

- Do not remove the global 3840-edge, 3:1, and pixel-limit protection.
- Add a feature-specific exact-size validator for every planned Premium A+ mother size (`2928 * 2..7` by `1200`), including `14640x1200`, `17568x1200`, and `20496x1200`.
- Preserve these sizes only when the pending task carries matching composed-plan metadata; normal custom sizes continue through existing normalization.
- Keep requested and actual dimensions separately. The detail page uses the image's natural dimensions for slicing decisions.

### 8. Detail-page slicing

- Add `切割高级A+` in the completed-image action area.
- Planned mother-image tasks preselect their expected slice count. Other suitable wide images can select 2-7 manually.
- Open a slicing dialog showing the source image, actual dimensions, expected ratio, numbered cut lines, and per-slice preview regions.
- Validate the actual aspect ratio against the selected count with a small rounding tolerance. Wrong-ratio images are blocked; the app never stretches, compresses, or silently crops them into compliance.
- Correct-ratio but low-resolution images may be sliced after a clarity warning.
- Slicing is resolution-independent: a seven-panel mother image does not have to be exactly `20496x1200` if the provider returns another resolution with the correct seven-panel aspect ratio. The natural image is split into seven equal-width regions without stretching; clarity is evaluated per resulting slice.
- Crop directly from the source with one canvas per slice, preserve PNG, and keep the original mother image unchanged.
- Save all slices as one derived task with ordered outputs and source-task/source-image metadata. The derived detail view supports individual download and a named ZIP containing all slices.

### 9. History and storage compatibility

- Add optional composed-layout fields to `AmazonPlannerSession`; old sessions without them restore as `independent`.
- Keep existing flat session fields intact for old history and the old tab.
- Add optional A+ generation context and derivation metadata to `TaskRecord`; IndexedDB needs no new object store.
- Image-retention, delete, backup, and restore logic must count derivation source images and all slice outputs as referenced assets.
- Restoring a composed session restores group order, brand story, selected plan, references, visual style, and generated planner text.

### 10. Code organization and verification

- Add focused modules/components instead of growing `AmazonPlanner.tsx` and `DetailModal.tsx` further: `premiumAPlusLayout.ts`, `imageSlicing.ts`, `PremiumAPlusLayoutEditor.tsx`, and `ImageSliceDialog.tsx`.
- Update `listingPlanner.ts`, `listingPlannerApi.ts`, `types.ts`, `size.ts`, `paramCompatibility.ts`, `store.ts`, `downloadImages.ts`, and the two parent components.
- Unit tests cover slot accounting, presets, AI-response normalization, continuous prompt rules, exact-size preservation, slice geometry/ratio checks, derived metadata, and old-session restoration.
- Run `npm test` and `npm run build`, then verify desktop/mobile planner layouts and detail-page cut-line previews with browser screenshots.
