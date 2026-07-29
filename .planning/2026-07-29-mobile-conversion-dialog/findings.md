# Findings

- Automatic detection uses `category.aPlusPlanContext.groupKind` and `sliceCount`; missing legacy metadata falls back to one image.
- `task.derivation` intentionally forces a selected derived slice to behave as a single image.
- The current slice dialog and geometry validator only recognize Premium A+ panel geometry.
- Mobile mother images need 1200x900 generation slices and 600x450 upload slices.
- Explicit conversion now creates continuous-canvas metadata even for legacy source tasks, so newly generated Mobile A+ mother images remain sliceable and classifiable.
- Selecting one panel deliberately removes stale mother-image context from the pending task category.
