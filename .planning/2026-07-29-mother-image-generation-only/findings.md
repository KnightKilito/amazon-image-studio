# Findings

- Planner module requirements explicitly say `then crop it into ... and upload each`, which encourages generated planMarkdown to include an output/cropping section.
- Full and compact planner guidance discuss future crops but do not explicitly prohibit post-processing instructions in planMarkdown.
- Appended full and plan-only generation requirements tell the image model what happens after generation, including an actionable `After generation`/`生成完成后再连续裁成` bullet.
- The website slicing implementation itself is separate and should remain unchanged.
- Historical planner sessions bypass API normalization, so post-processing section cleanup belongs in the shared `withAPlusGenerationSizes` path as well as new API normalization.
