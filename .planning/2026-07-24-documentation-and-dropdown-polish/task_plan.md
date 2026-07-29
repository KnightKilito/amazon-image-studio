# Documentation And Dropdown Polish

## Goal

Polish the Premium A+ arrangement dropdowns and replace the compact help modal with a responsive documentation page covering Listing images and Premium A+ workflows.

## Phases

- [complete] Inspect the existing Premium A+ native selects, shared Select component, model-ID dropdown, header help entry, and current help modal.
- [complete] Replace Premium A+ native selects with the shared styled dropdown component.
- [complete] Build the responsive documentation page and write the Listing/Premium A+ guides.
- [complete] Run tests/build and visually verify desktop/mobile layouts and dropdown behavior.
- [complete] Restore the legacy operation guide as a third document and split documentation content into maintainable modules.
- [complete] Re-run tests/build and verify the new document tab's responsive structure.
- [complete] Replace hard-coded React document bodies with auto-discovered Markdown files and Front Matter metadata.
- [complete] Add parser coverage, migrate all existing guides, and verify tests/build/rendering.

## Constraints

- Preserve all current Premium A+ arrangement behavior and slot accounting.
- Reuse established dropdown styles instead of introducing a separate visual system.
- Keep Listing images and Premium A+ as the primary workflow documents while preserving the legacy operation guide in its own tab.
- Desktop documentation uses left navigation and right content; mobile must remain readable without overlap.
- Documentation authors should be able to add, remove, reorder, and edit guides by changing only files under `src/docs`.

## Errors Encountered

| Error | Resolution |
|---|---|
