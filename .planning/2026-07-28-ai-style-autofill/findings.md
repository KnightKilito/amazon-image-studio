# Findings

- Search located AI style generation and UI controls in `src/components/AmazonPlanner.tsx` around the `aiStyleReference` state and the “重新生成风格图” action.
- The right-side explicit style-reference slot is store-owned as `styleReferenceImage`; submission logic already treats it separately from normal reference images.
- `generateAiStyleReference` currently stores the generated image, updates local `aiStyleReference`, and persists the planner session, but never writes the result into the store-owned right-side `styleReferenceImage` slot.
- The completion handler is asynchronous, so the emptiness check must read `useStore.getState().styleReferenceImage` at completion time rather than capture a stale render value.
- The generated image already has the exact `{ id, dataUrl }` shape required by the right-side slot.
- The store setter synchronizes the active gallery/agent input draft, so the conditional behavior should live as an atomic store action rather than a component-level read-then-write pair.
- An atomic `setStyleReferenceImageIfEmpty` action can return whether insertion happened and prevents a generated image from overwriting a style reference selected while generation was still running.
