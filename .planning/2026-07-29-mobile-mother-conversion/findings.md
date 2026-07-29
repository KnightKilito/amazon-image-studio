# Findings

- Mobile conversion currently hardcodes prompt and params to 1200x900.
- Continuous mother-image slice count is available at `task.category.aPlusPlanContext.sliceCount`.
- Derived slice tasks retain the original context, so `task.derivation` must force single-image conversion.
- Generic size normalization only preserves Premium mother-image sizes and would clamp large Mobile mother-image sizes.
