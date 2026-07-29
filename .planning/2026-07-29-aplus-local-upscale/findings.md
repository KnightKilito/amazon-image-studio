# Findings

- DetailModal already loads the real image dimensions into `imageSizes`.
- Existing slice-derived tasks provide the desired pattern for saving local PNG output as a new history task.
- Upscaled tasks should not use slice derivation metadata, because that would incorrectly show the ZIP-download UI and force later conversions to one panel.
- The action must remain visible regardless of current resolution. It performs at least a 2x proportional upscale and increases further only when needed to reach the format minimum.
