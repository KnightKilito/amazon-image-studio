# Findings

- `PremiumAPlusLayoutEditor.tsx` uses four native `<select>` controls with a basic border style.
- `SettingsModal.tsx` model-ID options use the same visual language as the shared `Select.tsx`: translucent surface, rounded menu, shadow, selected blue state, dark-mode support, and animated opening.
- The shared `Select.tsx` already supports the required option types and automatically chooses top/bottom placement inside scroll containers.
- The header question-mark button currently opens `HelpModal.tsx`, a compact action-guide modal. It is the natural entry point for the requested documentation page.
- The application does not use a router, so a full-screen portal documentation surface avoids adding routing and deployment complexity.

